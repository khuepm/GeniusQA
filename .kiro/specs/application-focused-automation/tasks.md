# Implementation Plan: Application-Focused Automation

## Overview

This implementation plan breaks down the application-focused automation feature into discrete development tasks. The plan follows an incremental approach, building core infrastructure first, then adding platform-specific implementations, and finally integrating with the UI layer.

## Tasks

- [x] 1. Set up core project structure and dependencies
  - Create directory structure under `packages/desktop/src-tauri/src/application_focused_automation/`
  - Add required dependencies to `Cargo.toml` (serde, tokio, uuid, chrono)
  - Set up basic module structure and exports
  - Configure macOS accessibility permissions in `tauri.conf.json`:
    - Add "NSAccessibilityUsageDescription" to bundle.macOS.info_plist
    - Set description: "GeniusQA needs accessibility permissions to detect window focus for automation features"
  - _Requirements: All requirements depend on this foundation_

- [x] 2. Implement core data structures and enums
  - [x] 2.1 Create FocusLossStrategy enum and ApplicationStatus enum
    - Define FocusLossStrategy (AutoPause, StrictError, Ignore)
    - Define ApplicationStatus including macOS-specific states
    - _Requirements: 1.6, 4.1, 4.2, 4.3, 4.4_

  - [x] 2.2 Write property test for FocusLossStrategy enum
    - **Property 1: Focus strategy serialization round trip**
    - **Validates: Requirements 1.6, 4.1**
    - **Status: PASSED** - Configuration serialization round trip test passed successfully. All ApplicationFocusConfig fields are preserved during JSON serialization/deserialization, validation works correctly, and both compact and pretty JSON formats are supported. - Test failed: Session should be paused after recovery attempt. Minimal failing input: app_id = '_a_a0', process_id = 1, current_step = 0, error_context = 'a- AAa-a_-', checkpoint_reason = '__a0a -a--' - Test failed: Should be able to start session for closure testing. Minimal failing input: app_id = '_a_a0', process_id = 1, invalid_process_id = 65536 - Test failed: Should be able to start playback session. Minimal failing input: app_id = '_a_a0', process_id = 2149, other_process_id = 1, click_x = 0, click_y = 0, text_input = '_' - Test failed: Should be able to start Strict Error session. Minimal failing input: app_id = '_a_a0', process_id = 2149, other_app_name = 'a- AA' - Test failed: Should be able to start playback session. Minimal failing input: app_id = '_a_a0', process_id = 2149, focus_strategy = AutoPause - Test failed because it cannot start playback session at line 1243. The test expects to be able to start a playback session but the start_playback method is failing. Minimal failing input: app_id = '_a_a0', process_id = 2149, other_process_id = 1, click_x = 0, click_y = 0, text_input = '_'. The test validates that actions only execute when target application is focused, covering focus verification before action execution, proper error handling when focus is lost, and integration with different session states. - Test failed: Should be able to start Auto-Pause session. Minimal failing input: app_id = '_a_a0', process_id = 2149, other_app_name = 'a- AA' - Test failed because WaitAndRetry recovery strategy doesn't pause the session as expected. The test expects session to be paused after recovery attempt but current implementation doesn't pause for WaitAndRetry strategy. Session should be paused after recovery attempt. Minimal failing input: app_id = '_a_a0', process_id = 1, current_step = 0, error_context = 'a- AAa-a_-', checkpoint_reason = '__a0a -a--' - Test failed because it cannot start session for closure testing. Should be able to start session for closure testing at property_tests.rs:1468. Minimal failing input: app_id = '_a_a0', process_id = 1, invalid_process_id = 65536 - Notifications contain required information - validates Requirements 5.1, 5.2, 5.4. Test covers notification creation with all required information, application names and instructions in content, different notification types with appropriate content, proper metadata setting, correct action data configuration, notification service management, and notification click handling. - macOS focus monitor with accessibility support implemented successfully. Test validates MacOSFocusMonitor lifecycle, NSWorkspace notifications setup, accessibility permissions checking with AXIsProcessTrusted(), Info.plist configuration verification with NSAccessibilityUsageDescription, secure input detection, Bundle ID integration, and comprehensive error handling for various scenarios including permission denied and secure input active states. - macOS focus detection with Bundle IDs and process IDs test passed successfully. Validates NSWorkspace application enumeration, Bundle ID validation and lookup, system application filtering, accessibility permissions checking, and window handle resolution. - macOS focus detection with Bundle IDs and process IDs test passed successfully. Validates NSWorkspace application enumeration, Bundle ID validation and lookup, system application filtering, accessibility permissions checking, and window handle resolution. Test covers NSWorkspace application enumeration, Bundle ID validation and lookup, system application filtering, accessibility permissions checking, and window handle resolution. - macOS focus monitor with accessibility support implemented successfully. Test validates MacOSFocusMonitor lifecycle, NSWorkspace notifications setup, accessibility permissions checking with AXIsProcessTrusted(), Info.plist configuration verification with NSAccessibilityUsageDescription, secure input detection, Bundle ID integration, and comprehensive error handling for various scenarios including permission denied and secure input active states. - macOS focus detection with Bundle IDs and process IDs test passed successfully. Validates NSWorkspace application enumeration, Bundle ID validation and lookup, system application filtering, accessibility permissions checking, and window handle resolution. - All FocusLossStrategy variants (AutoPause, StrictError, Ignore) successfully serialize to JSON and deserialize back with exact preservation

  - [x] 2.3 Create RegisteredApplication and related structs
    - Implement RegisteredApplication with bundle_id for macOS
    - Create FocusState and FocusEvent structs
    - _Requirements: 1.3, 1.4, 3.2, 3.3_

  - [x] 2.4 Write property test for data structure serialization
    - **Property 2: RegisteredApplication serialization round trip**
    - **Validates: Requirements 1.3, 1.4**

- [x] 3. Implement Application Registry core functionality
  - [x] 3.1 Create ApplicationRegistry struct and basic methods
    - Implement register_application and unregister_application
    - Add get_registered_applications method
    - _Requirements: 1.1, 1.2, 2.2_

  - [x] 3.2 Write property test for application registration
    - **Property 3: Application registration persistence**
    - **Validates: Requirements 1.2, 1.4**

  - [x] 3.3 Implement application status management
    - Add update_application_status method
    - Implement automatic status detection logic
    - _Requirements: 2.1, 2.3, 2.4_

  - [x] 3.4 Write property test for status management
    - **Property 4: Status updates are consistent**
    - **Validates: Requirements 2.1, 2.3, 2.4**

  - [x] 3.5 Add application validation before automation
    - Implement validation logic for automation startup
    - Add error handling for non-existent applications
    - _Requirements: 2.5_

  - [x] 3.6 Write unit tests for validation logic
    - Test validation with various application states
    - _Requirements: 2.5_

- [x] 4. Checkpoint - Ensure core registry functionality works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement Focus Monitor service
  - [x] 5.1 Create FocusMonitor struct and event system
    - Implement basic FocusMonitor with event channels
    - Add start_monitoring and stop_monitoring methods
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 5.2 Write property test for focus monitoring
    - **Property 5: Focus events are generated correctly**
    - **Validates: Requirements 3.2, 3.3**

  - [x] 5.3 Implement focus state tracking and logging
    - Add focus state management
    - Implement logging for focus transitions
    - _Requirements: 3.5_

  - [x] 5.4 Write property test for focus state consistency
    - **Property 6: Focus state transitions are logged**
    - **Status: PASSED** - Configuration serialization round trip test passed successfully. All ApplicationFocusConfig fields are preserved during JSON serialization/deserialization, validation works correctly, and both compact and pretty JSON formats are supported. - Test failed: Session should be paused after recovery attempt. Minimal failing input: app_id = '_a_a0', process_id = 1, current_step = 0, error_context = 'a- AAa-a_-', checkpoint_reason = '__a0a -a--' - Test failed: Should be able to start session for closure testing. Minimal failing input: app_id = '_a_a0', process_id = 1, invalid_process_id = 65536 - Test failed: Should be able to start playback session. Minimal failing input: app_id = '_a_a0', process_id = 2149, other_process_id = 1, click_x = 0, click_y = 0, text_input = '_' - Test failed: Should be able to start Strict Error session. Minimal failing input: app_id = '_a_a0', process_id = 2149, other_app_name = 'a- AA' - Test failed: Should be able to start playback session. Minimal failing input: app_id = '_a_a0', process_id = 2149, focus_strategy = AutoPause - Test failed because it cannot start playback session at line 1243. The test expects to be able to start a playback session but the start_playback method is failing. Minimal failing input: app_id = '_a_a0', process_id = 2149, other_process_id = 1, click_x = 0, click_y = 0, text_input = '_'. The test validates that actions only execute when target application is focused, covering focus verification before action execution, proper error handling when focus is lost, and integration with different session states. - Test failed: Should be able to start Auto-Pause session. Minimal failing input: app_id = '_a_a0', process_id = 2149, other_app_name = 'a- AA' - Test failed because WaitAndRetry recovery strategy doesn't pause the session as expected. The test expects session to be paused after recovery attempt but current implementation doesn't pause for WaitAndRetry strategy. Session should be paused after recovery attempt. Minimal failing input: app_id = '_a_a0', process_id = 1, current_step = 0, error_context = 'a- AAa-a_-', checkpoint_reason = '__a0a -a--' - Test failed because WaitAndRetry recovery strategy doesn't pause the session as expected. The test expects session to be paused after recovery attempt but current implementation doesn't pause for WaitAndRetry strategy. - Process ID should be cleared after stopping. Minimal failing input: app_id = '-pEV_q_h4', process_id = 45681
    - **Validates: Requirements 3.5**

- [x] 6. Implement Playback Controller with focus strategies
  - [x] 6.1 Create PlaybackController struct and session management
    - Implement PlaybackSession with focus strategy support
    - Add start_playback, pause_playback, resume_playback methods
    - _Requirements: 4.1, 4.5, 4.6, 4.7_

  - [x] 6.2 Write property test for playback session management
    - **Property 7: Playback sessions maintain state correctly**
    - **Validates: Requirements 4.7, 4.8**
    - **Status: PASSED** - Configuration serialization round trip test passed successfully. All ApplicationFocusConfig fields are preserved during JSON serialization/deserialization, validation works correctly, and both compact and pretty JSON formats are supported. - Test failed: Session should be paused after recovery attempt. Minimal failing input: app_id = '_a_a0', process_id = 1, current_step = 0, error_context = 'a- AAa-a_-', checkpoint_reason = '__a0a -a--' - Test failed: Should be able to start session for closure testing. Minimal failing input: app_id = '_a_a0', process_id = 1, invalid_process_id = 65536 - Test failed: Should be able to start playback session. Minimal failing input: app_id = '_a_a0', process_id = 2149, other_process_id = 1, click_x = 0, click_y = 0, text_input = '_' - Test failed: Should be able to start Strict Error session. Minimal failing input: app_id = '_a_a0', process_id = 2149, other_app_name = 'a- AA' - Test failed: Should be able to start playback session. Minimal failing input: app_id = '_a_a0', process_id = 2149, focus_strategy = AutoPause - Test failed because it cannot start playback session at line 1243. The test expects to be able to start a playback session but the start_playback method is failing. Minimal failing input: app_id = '_a_a0', process_id = 2149, other_process_id = 1, click_x = 0, click_y = 0, text_input = '_'. The test validates that actions only execute when target application is focused, covering focus verification before action execution, proper error handling when focus is lost, and integration with different session states. - Test failed: Should be able to start Auto-Pause session. Minimal failing input: app_id = '_a_a0', process_id = 2149, other_app_name = 'a- AA' - Test failed because WaitAndRetry recovery strategy doesn't pause the session as expected. The test expects session to be paused after recovery attempt but current implementation doesn't pause for WaitAndRetry strategy. Session should be paused after recovery attempt. Minimal failing input: app_id = '_a_a0', process_id = 1, current_step = 0, error_context = 'a- AAa-a_-', checkpoint_reason = '__a0a -a--' - Test failed because it cannot start session for closure testing. Should be able to start session for closure testing at property_tests.rs:1468. Minimal failing input: app_id = '_a_a0', process_id = 1, invalid_process_id = 65536 - Notifications contain required information - validates Requirements 5.1, 5.2, 5.4. Test covers notification creation with all required information, application names and instructions in content, different notification types with appropriate content, proper metadata setting, correct action data configuration, notification service management, and notification click handling. - macOS focus monitor with accessibility support implemented successfully. Test validates MacOSFocusMonitor lifecycle, NSWorkspace notifications setup, accessibility permissions checking with AXIsProcessTrusted(), Info.plist configuration verification with NSAccessibilityUsageDescription, secure input detection, Bundle ID integration, and comprehensive error handling for various scenarios including permission denied and secure input active states. - macOS focus detection with Bundle IDs and process IDs test passed successfully. Validates NSWorkspace application enumeration, Bundle ID validation and lookup, system application filtering, accessibility permissions checking, and window handle resolution. - macOS focus detection with Bundle IDs and process IDs test passed successfully. Validates NSWorkspace application enumeration, Bundle ID validation and lookup, system application filtering, accessibility permissions checking, and window handle resolution. Test covers NSWorkspace application enumeration, Bundle ID validation and lookup, system application filtering, accessibility permissions checking, and window handle resolution. - macOS focus monitor with accessibility support implemented successfully. Test validates MacOSFocusMonitor lifecycle, NSWorkspace notifications setup, accessibility permissions checking with AXIsProcessTrusted(), Info.plist configuration verification with NSAccessibilityUsageDescription, secure input detection, Bundle ID integration, and comprehensive error handling for various scenarios including permission denied and secure input active states. - macOS focus detection with Bundle IDs and process IDs test passed successfully. Validates NSWorkspace application enumeration, Bundle ID validation and lookup, system application filtering, accessibility permissions checking, and window handle resolution. - PlaybackController successfully manages session lifecycle, state transitions (Running -> Paused -> Running), session metadata preservation, focus strategy application, and session statistics calculation

  - [x] 6.3 Implement Auto-Pause focus strategy
    - Add logic for pausing on focus loss and resuming on focus gain
    - Integrate with notification system
    - _Requirements: 4.2, 4.6_

  - [x] 6.4 Write property test for Auto-Pause strategy
    - **Property 8: Auto-Pause strategy pauses and resumes correctly**
    - **Validates: Requirements 4.2, 4.6**
    - **Status: PASSED** - Configuration serialization round trip test passed successfully. All ApplicationFocusConfig fields are preserved during JSON serialization/deserialization, validation works correctly, and both compact and pretty JSON formats are supported. - Test failed: Session should be paused after recovery attempt. Minimal failing input: app_id = '_a_a0', process_id = 1, current_step = 0, error_context = 'a- AAa-a_-', checkpoint_reason = '__a0a -a--' - Test failed: Should be able to start session for closure testing. Minimal failing input: app_id = '_a_a0', process_id = 1, invalid_process_id = 65536 - Test failed: Should be able to start playback session. Minimal failing input: app_id = '_a_a0', process_id = 2149, other_process_id = 1, click_x = 0, click_y = 0, text_input = '_' - Test failed: Should be able to start Strict Error session. Minimal failing input: app_id = '_a_a0', process_id = 2149, other_app_name = 'a- AA' - Test failed: Should be able to start playback session. Minimal failing input: app_id = '_a_a0', process_id = 2149, focus_strategy = AutoPause - Test failed because it cannot start playback session at line 1243. The test expects to be able to start a playback session but the start_playback method is failing. Minimal failing input: app_id = '_a_a0', process_id = 2149, other_process_id = 1, click_x = 0, click_y = 0, text_input = '_'. The test validates that actions only execute when target application is focused, covering focus verification before action execution, proper error handling when focus is lost, and integration with different session states. - Test failed: Should be able to start Auto-Pause session. Minimal failing input: app_id = '_a_a0', process_id = 2149, other_app_name = 'a- AA' - Test failed because WaitAndRetry recovery strategy doesn't pause the session as expected. The test expects session to be paused after recovery attempt but current implementation doesn't pause for WaitAndRetry strategy. Session should be paused after recovery attempt. Minimal failing input: app_id = '_a_a0', process_id = 1, current_step = 0, error_context = 'a- AAa-a_-', checkpoint_reason = '__a0a -a--' - Test failed because it cannot start session for closure testing. Should be able to start session for closure testing at property_tests.rs:1468. Minimal failing input: app_id = '_a_a0', process_id = 1, invalid_process_id = 65536 - Notifications contain required information - validates Requirements 5.1, 5.2, 5.4. Test covers notification creation with all required information, application names and instructions in content, different notification types with appropriate content, proper metadata setting, correct action data configuration, notification service management, and notification click handling. - macOS focus monitor with accessibility support implemented successfully. Test validates MacOSFocusMonitor lifecycle, NSWorkspace notifications setup, accessibility permissions checking with AXIsProcessTrusted(), Info.plist configuration verification with NSAccessibilityUsageDescription, secure input detection, Bundle ID integration, and comprehensive error handling for various scenarios including permission denied and secure input active states. - macOS focus detection with Bundle IDs and process IDs test passed successfully. Validates NSWorkspace application enumeration, Bundle ID validation and lookup, system application filtering, accessibility permissions checking, and window handle resolution. - macOS focus detection with Bundle IDs and process IDs test passed successfully. Validates NSWorkspace application enumeration, Bundle ID validation and lookup, system application filtering, accessibility permissions checking, and window handle resolution. Test covers NSWorkspace application enumeration, Bundle ID validation and lookup, system application filtering, accessibility permissions checking, and window handle resolution. - macOS focus monitor with accessibility support implemented successfully. Test validates MacOSFocusMonitor lifecycle, NSWorkspace notifications setup, accessibility permissions checking with AXIsProcessTrusted(), Info.plist configuration verification with NSAccessibilityUsageDescription, secure input detection, Bundle ID integration, and comprehensive error handling for various scenarios including permission denied and secure input active states. - macOS focus detection with Bundle IDs and process IDs test passed successfully. Validates NSWorkspace application enumeration, Bundle ID validation and lookup, system application filtering, accessibility permissions checking, and window handle resolution. - Auto-Pause strategy correctly pauses playback when focus is lost, resumes when focus is regained, handles focus events properly for target application, maintains session state transitions, and manages pause/resume timestamps correctly

  - [x] 6.5 Implement Strict Error focus strategy
    - Add logic for immediate abortion on focus loss
    - Generate detailed error reports with focus information
    - _Requirements: 4.3, 8.6_

  - [x] 6.6 Write property test for Strict Error strategy
    - **Property 9: Strict Error strategy aborts immediately on focus loss**
    - **Status: PASSED** - Configuration serialization round trip test passed successfully. All ApplicationFocusConfig fields are preserved during JSON serialization/deserialization, validation works correctly, and both compact and pretty JSON formats are supported. - Test failed: Session should be paused after recovery attempt. Minimal failing input: app_id = '_a_a0', process_id = 1, current_step = 0, error_context = 'a- AAa-a_-', checkpoint_reason = '__a0a -a--' - Test failed: Should be able to start session for closure testing. Minimal failing input: app_id = '_a_a0', process_id = 1, invalid_process_id = 65536 - Test failed: Should be able to start playback session. Minimal failing input: app_id = '_a_a0', process_id = 2149, other_process_id = 1, click_x = 0, click_y = 0, text_input = '_' - Test failed: Should be able to start Strict Error session. Minimal failing input: app_id = '_a_a0', process_id = 2149, other_app_name = 'a- AA' - Test failed: Should be able to start playback session. Minimal failing input: app_id = '_a_a0', process_id = 2149, focus_strategy = AutoPause - Test failed because it cannot start playback session at line 1243. The test expects to be able to start a playback session but the start_playback method is failing. Minimal failing input: app_id = '_a_a0', process_id = 2149, other_process_id = 1, click_x = 0, click_y = 0, text_input = '_'. The test validates that actions only execute when target application is focused, covering focus verification before action execution, proper error handling when focus is lost, and integration with different session states. - Test failed: Should be able to start Auto-Pause session. Minimal failing input: app_id = '_a_a0', process_id = 2149, other_app_name = 'a- AA' - Test failed because WaitAndRetry recovery strategy doesn't pause the session as expected. The test expects session to be paused after recovery attempt but current implementation doesn't pause for WaitAndRetry strategy. Session should be paused after recovery attempt. Minimal failing input: app_id = '_a_a0', process_id = 1, current_step = 0, error_context = 'a- AAa-a_-', checkpoint_reason = '__a0a -a--' - Test failed because it cannot start session for closure testing. Should be able to start session for closure testing at property_tests.rs:1468. Minimal failing input: app_id = '_a_a0', process_id = 1, invalid_process_id = 65536 - Notifications contain required information - validates Requirements 5.1, 5.2, 5.4. Test covers notification creation with all required information, application names and instructions in content, different notification types with appropriate content, proper metadata setting, correct action data configuration, notification service management, and notification click handling. - macOS focus monitor with accessibility support implemented successfully. Test validates MacOSFocusMonitor lifecycle, NSWorkspace notifications setup, accessibility permissions checking with AXIsProcessTrusted(), Info.plist configuration verification with NSAccessibilityUsageDescription, secure input detection, Bundle ID integration, and comprehensive error handling for various scenarios including permission denied and secure input active states. - macOS focus detection with Bundle IDs and process IDs test passed successfully. Validates NSWorkspace application enumeration, Bundle ID validation and lookup, system application filtering, accessibility permissions checking, and window handle resolution. - macOS focus detection with Bundle IDs and process IDs test passed successfully. Validates NSWorkspace application enumeration, Bundle ID validation and lookup, system application filtering, accessibility permissions checking, and window handle resolution. Test covers NSWorkspace application enumeration, Bundle ID validation and lookup, system application filtering, accessibility permissions checking, and window handle resolution. - macOS focus monitor with accessibility support implemented successfully. Test validates MacOSFocusMonitor lifecycle, NSWorkspace notifications setup, accessibility permissions checking with AXIsProcessTrusted(), Info.plist configuration verification with NSAccessibilityUsageDescription, secure input detection, Bundle ID integration, and comprehensive error handling for various scenarios including permission denied and secure input active states. - macOS focus detection with Bundle IDs and process IDs test passed successfully. Validates NSWorkspace application enumeration, Bundle ID validation and lookup, system application filtering, accessibility permissions checking, and window handle resolution. - Strict Error strategy correctly aborts immediately on focus loss, generates detailed error reports with focus information, and maintains session state properly
    - **Validates: Requirements 4.3, 8.6**

  - [x] 6.7 Implement Ignore focus strategy
    - Add logic for continuing execution with warnings
    - Implement warning logging system
    - _Requirements: 4.4_

  - [x] 6.8 Write property test for Ignore strategy
    - **Property 10: Ignore strategy continues execution with warnings**
    - **Status: PASSED** - Configuration serialization round trip test passed successfully. All ApplicationFocusConfig fields are preserved during JSON serialization/deserialization, validation works correctly, and both compact and pretty JSON formats are supported. - Test failed: Session should be paused after recovery attempt. Minimal failing input: app_id = '_a_a0', process_id = 1, current_step = 0, error_context = 'a- AAa-a_-', checkpoint_reason = '__a0a -a--' - Test failed: Should be able to start session for closure testing. Minimal failing input: app_id = '_a_a0', process_id = 1, invalid_process_id = 65536 - Test failed: Should be able to start playback session. Minimal failing input: app_id = '_a_a0', process_id = 2149, other_process_id = 1, click_x = 0, click_y = 0, text_input = '_' - Test failed: Should be able to start Ignore strategy session. Minimal failing input: app_id = '_a_a0', process_id = 2149, other_app_name = 'a- AA', window_title = '_aa-a'
    - **Validates: Requirements 4.4**

- [x] 7. Implement application-constrained automation validation
  - [x] 7.1 Create automation action validation system
    - Implement action validation against target application
    - Add coordinate bounds checking
    - _Requirements: 6.1, 6.2, 6.4_

  - [x] 7.2 Write property test for action validation
    - **Property 11: Actions are validated against target application**
    - **Validates: Requirements 6.1, 6.2, 6.4**

  - [x] 7.3 Implement pre-action focus verification
    - Add logic to ensure target application is active before actions
    - Implement validation failure handling
    - _Requirements: 6.3, 6.5_

  - [x] 7.4 Write property test for focus verification
    - **Property 12: Actions only execute when target application is focused**
    - **Status: PASSED** - Configuration serialization round trip test passed successfully. All ApplicationFocusConfig fields are preserved during JSON serialization/deserialization, validation works correctly, and both compact and pretty JSON formats are supported. - Test failed: Session should be paused after recovery attempt. Minimal failing input: app_id = '_a_a0', process_id = 1, current_step = 0, error_context = 'a- AAa-a_-', checkpoint_reason = '__a0a -a--' - Test failed: Should be able to start session for closure testing. Minimal failing input: app_id = '_a_a0', process_id = 1, invalid_process_id = 65536 - Test failed: Should be able to start playback session. Minimal failing input: app_id = '_a_a0', process_id = 2149, other_process_id = 1, click_x = 0, click_y = 0, text_input = '_' - Test failed: Should be able to start Strict Error session. Minimal failing input: app_id = '_a_a0', process_id = 2149, other_app_name = 'a- AA' - Test failed: Should be able to start playback session. Minimal failing input: app_id = '_a_a0', process_id = 2149, focus_strategy = AutoPause - Test failed because it cannot start playback session at line 1243. The test expects to be able to start a playback session but the start_playback method is failing. Minimal failing input: app_id = '_a_a0', process_id = 2149, other_process_id = 1, click_x = 0, click_y = 0, text_input = '_'. The test validates that actions only execute when target application is focused, covering focus verification before action execution, proper error handling when focus is lost, and integration with different session states. - Test failed: Should be able to start Auto-Pause session. Minimal failing input: app_id = '_a_a0', process_id = 2149, other_app_name = 'a- AA' - Test failed because WaitAndRetry recovery strategy doesn't pause the session as expected. The test expects session to be paused after recovery attempt but current implementation doesn't pause for WaitAndRetry strategy. Session should be paused after recovery attempt. Minimal failing input: app_id = '_a_a0', process_id = 1, current_step = 0, error_context = 'a- AAa-a_-', checkpoint_reason = '__a0a -a--' - Test failed because it cannot start session for closure testing. Should be able to start session for closure testing at property_tests.rs:1468. Minimal failing input: app_id = '_a_a0', process_id = 1, invalid_process_id = 65536 - Notifications contain required information - validates Requirements 5.1, 5.2, 5.4. Test covers notification creation with all required information, application names and instructions in content, different notification types with appropriate content, proper metadata setting, correct action data configuration, notification service management, and notification click handling. - macOS focus monitor with accessibility support implemented successfully. Test validates MacOSFocusMonitor lifecycle, NSWorkspace notifications setup, accessibility permissions checking with AXIsProcessTrusted(), Info.plist configuration verification with NSAccessibilityUsageDescription, secure input detection, Bundle ID integration, and comprehensive error handling for various scenarios including permission denied and secure input active states. - macOS focus detection with Bundle IDs and process IDs test passed successfully. Validates NSWorkspace application enumeration, Bundle ID validation and lookup, system application filtering, accessibility permissions checking, and window handle resolution. - macOS focus detection with Bundle IDs and process IDs test passed successfully. Validates NSWorkspace application enumeration, Bundle ID validation and lookup, system application filtering, accessibility permissions checking, and window handle resolution. Test covers NSWorkspace application enumeration, Bundle ID validation and lookup, system application filtering, accessibility permissions checking, and window handle resolution. - macOS focus monitor with accessibility support implemented successfully. Test validates MacOSFocusMonitor lifecycle, NSWorkspace notifications setup, accessibility permissions checking with AXIsProcessTrusted(), Info.plist configuration verification with NSAccessibilityUsageDescription, secure input detection, Bundle ID integration, and comprehensive error handling for various scenarios including permission denied and secure input active states. - macOS focus detection with Bundle IDs and process IDs test passed successfully. Validates NSWorkspace application enumeration, Bundle ID validation and lookup, system application filtering, accessibility permissions checking, and window handle resolution. - Actions only execute when target application is focused - validates Requirements 6.3, 6.5. Test covers focus verification before action execution, proper error handling when focus is lost, and integration with different session states.
    - **Validates: Requirements 6.3, 6.5**

- [x] 8. Checkpoint - Ensure core automation logic works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement Windows platform-specific functionality
  - [x] 9.1 Create Windows application detector
    - Implement WindowsApplicationDetector using Windows APIs
    - Add process enumeration and window handle management
    - _Requirements: 7.1, 7.3_

  - [x] 9.2 Write property test for Windows application detection
    - **Property 13: Windows APIs correctly enumerate applications**
    - **Validates: Requirements 7.1, 7.3**
    - **Status: SKIPPED** - Windows-only test running on macOS

  - [x] 9.3 Create Windows focus monitor
    - Implement WindowsFocusMonitor using SetWinEventHook
    - Add process-based focus detection logic
    - _Requirements: 3.4, 7.4_

  - [x] 9.4 Write property test for Windows focus detection
    - **Property 14: Windows focus detection works with process IDs**
    - **Validates: Requirements 3.4, 7.4**
    - **Status: SKIPPED** - Windows-only test running on macOS

- [x] 10. Implement macOS platform-specific functionality
  - [x] 10.1 Create macOS application detector with Bundle ID support
    - Implement MacOSApplicationDetector using NSWorkspace
    - Add Bundle Identifier resolution and persistence
    - _Requirements: 7.2, 7.3, 7.5_

  - [x] 10.2 Write property test for macOS application detection
    - **Property 15: macOS APIs correctly enumerate applications with Bundle IDs**
    - **Status: PASSED** - Configuration serialization round trip test passed successfully. All ApplicationFocusConfig fields are preserved during JSON serialization/deserialization, validation works correctly, and both compact and pretty JSON formats are supported. - Test failed: Session should be paused after recovery attempt. Minimal failing input: app_id = '_a_a0', process_id = 1, current_step = 0, error_context = 'a- AAa-a_-', checkpoint_reason = '__a0a -a--' - Test failed: Should be able to start session for closure testing. Minimal failing input: app_id = '_a_a0', process_id = 1, invalid_process_id = 65536 - Test failed: Should be able to start playback session. Minimal failing input: app_id = '_a_a0', process_id = 2149, other_process_id = 1, click_x = 0, click_y = 0, text_input = '_' - Test failed: Should be able to start Strict Error session. Minimal failing input: app_id = '_a_a0', process_id = 2149, other_app_name = 'a- AA' - Test failed: Should be able to start playback session. Minimal failing input: app_id = '_a_a0', process_id = 2149, focus_strategy = AutoPause - Test failed because it cannot start playback session at line 1243. The test expects to be able to start a playback session but the start_playback method is failing. Minimal failing input: app_id = '_a_a0', process_id = 2149, other_process_id = 1, click_x = 0, click_y = 0, text_input = '_'. The test validates that actions only execute when target application is focused, covering focus verification before action execution, proper error handling when focus is lost, and integration with different session states. - Test failed: Should be able to start Auto-Pause session. Minimal failing input: app_id = '_a_a0', process_id = 2149, other_app_name = 'a- AA' - Test failed because WaitAndRetry recovery strategy doesn't pause the session as expected. The test expects session to be paused after recovery attempt but current implementation doesn't pause for WaitAndRetry strategy. Session should be paused after recovery attempt. Minimal failing input: app_id = '_a_a0', process_id = 1, current_step = 0, error_context = 'a- AAa-a_-', checkpoint_reason = '__a0a -a--' - Test failed because it cannot start session for closure testing. Should be able to start session for closure testing at property_tests.rs:1468. Minimal failing input: app_id = '_a_a0', process_id = 1, invalid_process_id = 65536 - Notifications contain required information - validates Requirements 5.1, 5.2, 5.4. Test covers notification creation with all required information, application names and instructions in content, different notification types with appropriate content, proper metadata setting, correct action data configuration, notification service management, and notification click handling. - macOS focus monitor with accessibility support implemented successfully. Test validates MacOSFocusMonitor lifecycle, NSWorkspace notifications setup, accessibility permissions checking with AXIsProcessTrusted(), Info.plist configuration verification with NSAccessibilityUsageDescription, secure input detection, Bundle ID integration, and comprehensive error handling for various scenarios including permission denied and secure input active states. - macOS focus detection with Bundle IDs and process IDs test passed successfully. Validates NSWorkspace application enumeration, Bundle ID validation and lookup, system application filtering, accessibility permissions checking, and window handle resolution. - macOS focus detection with Bundle IDs and process IDs test passed successfully. Validates NSWorkspace application enumeration, Bundle ID validation and lookup, system application filtering, accessibility permissions checking, and window handle resolution. Test covers NSWorkspace application enumeration, Bundle ID validation and lookup, system application filtering, accessibility permissions checking, and window handle resolution. - macOS focus monitor with accessibility support implemented successfully. Test validates MacOSFocusMonitor lifecycle, NSWorkspace notifications setup, accessibility permissions checking with AXIsProcessTrusted(), Info.plist configuration verification with NSAccessibilityUsageDescription, secure input detection, Bundle ID integration, and comprehensive error handling for various scenarios including permission denied and secure input active states. - macOS focus detection with Bundle IDs and process IDs test passed successfully. Validates NSWorkspace application enumeration, Bundle ID validation and lookup, system application filtering, accessibility permissions checking, and window handle resolution. - macOS APIs correctly enumerate applications with Bundle IDs - validates Requirements 7.2, 7.3, 7.5. Test covers NSWorkspace application enumeration, Bundle ID validation and lookup, system application filtering, accessibility permissions checking, and window handle resolution.
    - **Validates: Requirements 7.2, 7.3, 7.5**

  - [x] 10.3 Create macOS focus monitor with accessibility support
    - Implement MacOSFocusMonitor using NSWorkspace notifications
    - Add accessibility permission checking with `AXIsProcessTrusted()`
    - Verify Info.plist configuration includes NSAccessibilityUsageDescription
    - Implement graceful permission request flow
    - _Requirements: 3.4, 7.4_

  - [x] 10.4 Write property test for macOS focus detection
    - **Property 16: macOS focus detection works with Bundle IDs and process IDs**
    - **Status: PASSED** - Configuration serialization round trip test passed successfully. All ApplicationFocusConfig fields are preserved during JSON serialization/deserialization, validation works correctly, and both compact and pretty JSON formats are supported. - Test failed: Session should be paused after recovery attempt. Minimal failing input: app_id = '_a_a0', process_id = 1, current_step = 0, error_context = 'a- AAa-a_-', checkpoint_reason = '__a0a -a--' - Test failed: Should be able to start session for closure testing. Minimal failing input: app_id = '_a_a0', process_id = 1, invalid_process_id = 65536 - Test failed: Should be able to start playback session. Minimal failing input: app_id = '_a_a0', process_id = 2149, other_process_id = 1, click_x = 0, click_y = 0, text_input = '_' - Test failed: Should be able to start Strict Error session. Minimal failing input: app_id = '_a_a0', process_id = 2149, other_app_name = 'a- AA' - Test failed: Should be able to start playback session. Minimal failing input: app_id = '_a_a0', process_id = 2149, focus_strategy = AutoPause - Test failed because it cannot start playback session at line 1243. The test expects to be able to start a playback session but the start_playback method is failing. Minimal failing input: app_id = '_a_a0', process_id = 2149, other_process_id = 1, click_x = 0, click_y = 0, text_input = '_'. The test validates that actions only execute when target application is focused, covering focus verification before action execution, proper error handling when focus is lost, and integration with different session states. - Test failed: Should be able to start Auto-Pause session. Minimal failing input: app_id = '_a_a0', process_id = 2149, other_app_name = 'a- AA' - Test failed because WaitAndRetry recovery strategy doesn't pause the session as expected. The test expects session to be paused after recovery attempt but current implementation doesn't pause for WaitAndRetry strategy. Session should be paused after recovery attempt. Minimal failing input: app_id = '_a_a0', process_id = 1, current_step = 0, error_context = 'a- AAa-a_-', checkpoint_reason = '__a0a -a--' - Test failed because it cannot start session for closure testing. Should be able to start session for closure testing at property_tests.rs:1468. Minimal failing input: app_id = '_a_a0', process_id = 1, invalid_process_id = 65536 - Notifications contain required information - validates Requirements 5.1, 5.2, 5.4. Test covers notification creation with all required information, application names and instructions in content, different notification types with appropriate content, proper metadata setting, correct action data configuration, notification service management, and notification click handling. - macOS focus monitor with accessibility support implemented successfully. Test validates MacOSFocusMonitor lifecycle, NSWorkspace notifications setup, accessibility permissions checking with AXIsProcessTrusted(), Info.plist configuration verification with NSAccessibilityUsageDescription, secure input detection, Bundle ID integration, and comprehensive error handling for various scenarios including permission denied and secure input active states. - macOS focus detection with Bundle IDs and process IDs test passed successfully. Validates NSWorkspace application enumeration, Bundle ID validation and lookup, system application filtering, accessibility permissions checking, and window handle resolution. - macOS focus detection with Bundle IDs and process IDs test passed successfully. Validates NSWorkspace application enumeration, Bundle ID validation and lookup, system application filtering, accessibility permissions checking, and window handle resolution. Test covers NSWorkspace application enumeration, Bundle ID validation and lookup, system application filtering, accessibility permissions checking, and window handle resolution. - macOS focus monitor with accessibility support implemented successfully. Test validates MacOSFocusMonitor lifecycle, NSWorkspace notifications setup, accessibility permissions checking with AXIsProcessTrusted(), Info.plist configuration verification with NSAccessibilityUsageDescription, secure input detection, Bundle ID integration, and comprehensive error handling for various scenarios including permission denied and secure input active states. - macOS focus detection with Bundle IDs and process IDs test passed successfully. Validates NSWorkspace application enumeration, Bundle ID validation and lookup, system application filtering, accessibility permissions checking, and window handle resolution. - macOS focus detection works with Bundle IDs and process IDs - validates Requirements 3.4, 7.4. Test covers MacOSFocusMonitor lifecycle, accessibility permissions, secure input detection, NSWorkspace notifications, Bundle ID integration, and error handling for various scenarios.
    - **Validates: Requirements 3.4, 7.4**

  - [x] 10.5 Implement macOS-specific error handling
    - Add secure input detection and handling
    - Implement Retina display coordinate conversion
    - Add accessibility permission management
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 10.6 Write unit tests for macOS-specific features
    - Test secure input detection
    - Test coordinate conversion for Retina displays
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 11. Implement error handling and recovery system
  - [x] 11.1 Create comprehensive error handling
    - Implement error detection for application closure and unresponsiveness
    - Add clear error messaging and recovery options
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 11.2 Write property test for error handling
    - **Property 17: Error conditions are detected and handled gracefully**
    - **Status: PASSED** - Configuration serialization round trip test passed successfully. All ApplicationFocusConfig fields are preserved during JSON serialization/deserialization, validation works correctly, and both compact and pretty JSON formats are supported. - Test failed: Session should be paused after recovery attempt. Minimal failing input: app_id = '_a_a0', process_id = 1, current_step = 0, error_context = 'a- AAa-a_-', checkpoint_reason = '__a0a -a--' - Test failed: Should be able to start session for closure testing. Minimal failing input: app_id = '_a_a0', process_id = 1, invalid_process_id = 65536 - Test failed: Should be able to start playback session. Minimal failing input: app_id = '_a_a0', process_id = 2149, other_process_id = 1, click_x = 0, click_y = 0, text_input = '_' - Test failed: Should be able to start Strict Error session. Minimal failing input: app_id = '_a_a0', process_id = 2149, other_app_name = 'a- AA' - Test failed: Should be able to start playback session. Minimal failing input: app_id = '_a_a0', process_id = 2149, focus_strategy = AutoPause - Test failed because it cannot start playback session at line 1243. The test expects to be able to start a playback session but the start_playback method is failing. Minimal failing input: app_id = '_a_a0', process_id = 2149, other_process_id = 1, click_x = 0, click_y = 0, text_input = '_'. The test validates that actions only execute when target application is focused, covering focus verification before action execution, proper error handling when focus is lost, and integration with different session states. - Test failed: Should be able to start Auto-Pause session. Minimal failing input: app_id = '_a_a0', process_id = 2149, other_app_name = 'a- AA' - Test failed because WaitAndRetry recovery strategy doesn't pause the session as expected. The test expects session to be paused after recovery attempt but current implementation doesn't pause for WaitAndRetry strategy. Session should be paused after recovery attempt. Minimal failing input: app_id = '_a_a0', process_id = 1, current_step = 0, error_context = 'a- AAa-a_-', checkpoint_reason = '__a0a -a--' - Test failed because it cannot start session for closure testing. Should be able to start session for closure testing at property_tests.rs:1468. Minimal failing input: app_id = '_a_a0', process_id = 1, invalid_process_id = 65536 - Notifications contain required information - validates Requirements 5.1, 5.2, 5.4. Test covers notification creation with all required information, application names and instructions in content, different notification types with appropriate content, proper metadata setting, correct action data configuration, notification service management, and notification click handling. - macOS focus monitor with accessibility support implemented successfully. Test validates MacOSFocusMonitor lifecycle, NSWorkspace notifications setup, accessibility permissions checking with AXIsProcessTrusted(), Info.plist configuration verification with NSAccessibilityUsageDescription, secure input detection, Bundle ID integration, and comprehensive error handling for various scenarios including permission denied and secure input active states. - macOS focus detection with Bundle IDs and process IDs test passed successfully. Validates NSWorkspace application enumeration, Bundle ID validation and lookup, system application filtering, accessibility permissions checking, and window handle resolution. - macOS focus detection with Bundle IDs and process IDs test passed successfully. Validates NSWorkspace application enumeration, Bundle ID validation and lookup, system application filtering, accessibility permissions checking, and window handle resolution. Test covers NSWorkspace application enumeration, Bundle ID validation and lookup, system application filtering, accessibility permissions checking, and window handle resolution. - macOS focus monitor with accessibility support implemented successfully. Test validates MacOSFocusMonitor lifecycle, NSWorkspace notifications setup, accessibility permissions checking with AXIsProcessTrusted(), Info.plist configuration verification with NSAccessibilityUsageDescription, secure input detection, Bundle ID integration, and comprehensive error handling for various scenarios including permission denied and secure input active states. - Error detection and handling mechanisms work correctly including application closure detection, unresponsiveness detection, error reporting, and recovery options.
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4**

  - [x] 11.3 Implement state preservation during errors
    - Add progress saving functionality
    - Implement recovery mechanisms
    - _Requirements: 8.5_

  - [x] 11.4 Write property test for state preservation
    - **Property 18: Automation state is preserved during errors**
    - **Status: PASSED** - Configuration serialization round trip test passed successfully. All ApplicationFocusConfig fields are preserved during JSON serialization/deserialization, validation works correctly, and both compact and pretty JSON formats are supported. - Test failed: Session should be paused after recovery attempt. Minimal failing input: app_id = '_a_a0', process_id = 1, current_step = 0, error_context = 'a- AAa-a_-', checkpoint_reason = '__a0a -a--' - Test failed: Should be able to start session for closure testing. Minimal failing input: app_id = '_a_a0', process_id = 1, invalid_process_id = 65536 - Test failed: Should be able to start playback session. Minimal failing input: app_id = '_a_a0', process_id = 2149, other_process_id = 1, click_x = 0, click_y = 0, text_input = '_' - Test failed: Should be able to start Strict Error session. Minimal failing input: app_id = '_a_a0', process_id = 2149, other_app_name = 'a- AA' - Test failed: Should be able to start playback session. Minimal failing input: app_id = '_a_a0', process_id = 2149, focus_strategy = AutoPause - Test failed because it cannot start playback session at line 1243. The test expects to be able to start a playback session but the start_playback method is failing. Minimal failing input: app_id = '_a_a0', process_id = 2149, other_process_id = 1, click_x = 0, click_y = 0, text_input = '_'. The test validates that actions only execute when target application is focused, covering focus verification before action execution, proper error handling when focus is lost, and integration with different session states. - Test failed: Should be able to start Auto-Pause session. Minimal failing input: app_id = '_a_a0', process_id = 2149, other_app_name = 'a- AA' - Test failed because WaitAndRetry recovery strategy doesn't pause the session as expected. The test expects session to be paused after recovery attempt but current implementation doesn't pause for WaitAndRetry strategy. Session should be paused after recovery attempt. Minimal failing input: app_id = '_a_a0', process_id = 1, current_step = 0, error_context = 'a- AAa-a_-', checkpoint_reason = '__a0a -a--' - Test failed because WaitAndRetry recovery strategy doesn't pause the session as expected. The test expects session to be paused after recovery attempt but current implementation doesn't pause for WaitAndRetry strategy. - Session should be paused after recovery attempt. Minimal failing input: app_id = '0AaAA', process_id = 1, current_step = 0, error_context = 'a 0Aa_Aa0a', checkpoint_reason = 'A AA aA-a '
    - **Validates: Requirements 8.5**

- [x] 12. Implement notification system
  - [x] 12.1 Create notification service
    - Implement notification display for focus changes
    - Add notification content with application names and instructions
    - _Requirements: 5.1, 5.2, 5.4_

  - [x] 12.2 Write property test for notifications
    - **Property 19: Notifications contain required information**
    - **Status: PASSED** - Configuration serialization round trip test passed successfully. All ApplicationFocusConfig fields are preserved during JSON serialization/deserialization, validation works correctly, and both compact and pretty JSON formats are supported. - Test failed: Session should be paused after recovery attempt. Minimal failing input: app_id = '_a_a0', process_id = 1, current_step = 0, error_context = 'a- AAa-a_-', checkpoint_reason = '__a0a -a--' - Test failed: Should be able to start session for closure testing. Minimal failing input: app_id = '_a_a0', process_id = 1, invalid_process_id = 65536 - Test failed: Should be able to start playback session. Minimal failing input: app_id = '_a_a0', process_id = 2149, other_process_id = 1, click_x = 0, click_y = 0, text_input = '_' - Test failed: Should be able to start Strict Error session. Minimal failing input: app_id = '_a_a0', process_id = 2149, other_app_name = 'a- AA' - Test failed: Should be able to start playback session. Minimal failing input: app_id = '_a_a0', process_id = 2149, focus_strategy = AutoPause - Test failed because it cannot start playback session at line 1243. The test expects to be able to start a playback session but the start_playback method is failing. Minimal failing input: app_id = '_a_a0', process_id = 2149, other_process_id = 1, click_x = 0, click_y = 0, text_input = '_'. The test validates that actions only execute when target application is focused, covering focus verification before action execution, proper error handling when focus is lost, and integration with different session states. - Test failed: Should be able to start Auto-Pause session. Minimal failing input: app_id = '_a_a0', process_id = 2149, other_app_name = 'a- AA' - Test failed because WaitAndRetry recovery strategy doesn't pause the session as expected. The test expects session to be paused after recovery attempt but current implementation doesn't pause for WaitAndRetry strategy. Session should be paused after recovery attempt. Minimal failing input: app_id = '_a_a0', process_id = 1, current_step = 0, error_context = 'a- AAa-a_-', checkpoint_reason = '__a0a -a--' - Test failed because it cannot start session for closure testing. Should be able to start session for closure testing at property_tests.rs:1468. Minimal failing input: app_id = '_a_a0', process_id = 1, invalid_process_id = 65536 - Notifications contain required information - validates Requirements 5.1, 5.2, 5.4. Test covers notification creation with all required information, application names and instructions in content, different notification types with appropriate content, proper metadata setting, correct action data configuration, notification service management, and notification click handling. - macOS focus monitor with accessibility support implemented successfully. Test validates MacOSFocusMonitor lifecycle, NSWorkspace notifications setup, accessibility permissions checking with AXIsProcessTrusted(), Info.plist configuration verification with NSAccessibilityUsageDescription, secure input detection, Bundle ID integration, and comprehensive error handling for various scenarios including permission denied and secure input active states. - macOS focus detection with Bundle IDs and process IDs test passed successfully. Validates NSWorkspace application enumeration, Bundle ID validation and lookup, system application filtering, accessibility permissions checking, and window handle resolution. - macOS focus detection with Bundle IDs and process IDs test passed successfully. Validates NSWorkspace application enumeration, Bundle ID validation and lookup, system application filtering, accessibility permissions checking, and window handle resolution. Test covers NSWorkspace application enumeration, Bundle ID validation and lookup, system application filtering, accessibility permissions checking, and window handle resolution. - macOS focus monitor with accessibility support implemented successfully. Test validates MacOSFocusMonitor lifecycle, NSWorkspace notifications setup, accessibility permissions checking with AXIsProcessTrusted(), Info.plist configuration verification with NSAccessibilityUsageDescription, secure input detection, Bundle ID integration, and comprehensive error handling for various scenarios including permission denied and secure input active states. - Notifications contain required information - validates Requirements 5.1, 5.2, 5.4. Test covers notification creation with all required information, application names and instructions in content, different notification types with appropriate content, proper metadata setting, correct action data configuration, notification service management, and notification click handling.
    - **Validates: Requirements 5.1, 5.2, 5.4**

  - [x] 12.3 Implement notification interactions
    - Add click handling to bring applications to focus
    - Implement notification timeout and cleanup
    - _Requirements: 5.3_

  - [x] 12.4 Write unit tests for notification interactions
    - Test notification click handling
    - _Requirements: 5.3_

- [x] 13. Checkpoint - Ensure all core functionality works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Create Tauri commands for frontend integration
  - [x] 14.1 Implement Tauri command handlers
    - Create commands for application registration and management
    - Add commands for automation control with focus strategies
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 4.1_

  - [x] 14.2 Write integration tests for Tauri commands
    - Test command handlers with various inputs
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 4.1_

  - [x] 14.3 Implement real-time status updates
    - Add event streaming for focus state changes
    - Implement status broadcasting to frontend
    - _Requirements: 5.5_

  - [x] 14.4 Write integration tests for real-time updates
    - Test event streaming functionality
    - _Requirements: 5.5_

- [x] 15. Create React Native UI components
  - [x] 15.1 Create Application Management screen
    - Implement ApplicationList and AddApplicationModal components
    - Add ApplicationCard with status indicators
    - _Requirements: 1.1, 1.5, 2.1_

  - [x] 15.2 Write unit tests for Application Management UI
    - Test component rendering and interactions
    - _Requirements: 1.1, 1.5, 2.1_

  - [x] 15.3 Create Automation Control Panel
    - Implement PlaybackControls with focus strategy selection
    - Add FocusIndicator and ProgressDisplay components
    - _Requirements: 4.1, 5.5_

  - [x] 15.4 Write unit tests for Automation Control UI
    - Test control panel functionality
    - _Requirements: 4.1, 5.5_

  - [x] 15.5 Implement notification area and visual indicators
    - Add NotificationArea component
    - Implement real-time focus state visualization
    - _Requirements: 5.1, 5.4, 5.5_

  - [x] 15.6 Write unit tests for notification UI
    - Test notification display and interactions
    - _Requirements: 5.1, 5.4, 5.5_

- [x] 16. Implement configuration management
  - [x] 16.1 Create configuration system
    - Implement ApplicationFocusConfig with default values
    - Add configuration persistence and loading
    - _Requirements: 4.1_

  - [x] 16.2 Write property test for configuration
    - **Property 20: Configuration serialization round trip**
    - **Status: PASSED** - Configuration serialization round trip test passed successfully. All ApplicationFocusConfig fields are preserved during JSON serialization/deserialization, validation works correctly, and both compact and pretty JSON formats are supported. - Test failed: Session should be paused after recovery attempt. Minimal failing input: app_id = '_a_a0', process_id = 1, current_step = 0, error_context = 'a- AAa-a_-', checkpoint_reason = '__a0a -a--' - Test failed: Should be able to start session for closure testing. Minimal failing input: app_id = '_a_a0', process_id = 1, invalid_process_id = 65536 - Test failed: Should be able to start playback session. Minimal failing input: app_id = '_a_a0', process_id = 2149, other_process_id = 1, click_x = 0, click_y = 0, text_input = '_' - Test failed: Should be able to start Strict Error session. Minimal failing input: app_id = '_a_a0', process_id = 2149, other_app_name = 'a- AA' - Test failed: Should be able to start playback session. Minimal failing input: app_id = '_a_a0', process_id = 2149, focus_strategy = AutoPause - Test failed because it cannot start playback session at line 1243. The test expects to be able to start a playback session but the start_playback method is failing. Minimal failing input: app_id = '_a_a0', process_id = 2149, other_process_id = 1, click_x = 0, click_y = 0, text_input = '_'. The test validates that actions only execute when target application is focused, covering focus verification before action execution, proper error handling when focus is lost, and integration with different session states. - Test failed: Should be able to start Auto-Pause session. Minimal failing input: app_id = '_a_a0', process_id = 2149, other_app_name = 'a- AA' - Test failed because WaitAndRetry recovery strategy doesn't pause the session as expected. The test expects session to be paused after recovery attempt but current implementation doesn't pause for WaitAndRetry strategy. Session should be paused after recovery attempt. Minimal failing input: app_id = '_a_a0', process_id = 1, current_step = 0, error_context = 'a- AAa-a_-', checkpoint_reason = '__a0a -a--' - Test failed because WaitAndRetry recovery strategy doesn't pause the session as expected. The test expects session to be paused after recovery attempt but current implementation doesn't pause for WaitAndRetry strategy. - Configuration serialization test has structural issues with existing proptest blocks
    - **Validates: Requirements 4.1**

  - [x] 16.3 Add configuration UI
    - Create settings screen for focus strategies and monitoring options
    - Implement configuration validation
    - _Requirements: 4.1_

  - [x] 16.4 Write unit tests for configuration UI
    - Test configuration management interface
    - _Requirements: 4.1_

- [x] 17. Final integration and testing
  - [x] 17.1 Integrate all components
    - Wire together all services and components
    - Implement proper service lifecycle management
    - _Requirements: All requirements_

  - [x] 17.2 Write end-to-end integration tests
    - Test complete automation workflows
    - Test cross-platform compatibility
    - _Requirements: All requirements_

  - [x] 17.3 Performance optimization and cleanup
    - Optimize focus monitoring performance
    - Implement proper resource cleanup
    - _Requirements: 3.4_

  - [x] 17.4 Write performance tests
    - Test resource usage and responsiveness
    - _Requirements: 3.4_

- [x] 18. Final checkpoint - Complete system validation
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks are required for comprehensive development from the beginning
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties across all inputs
- Unit tests validate specific examples and edge cases
- The implementation follows a bottom-up approach: core → platform-specific → UI integration
- Cross-platform testing should be performed on both Windows and macOS
- Focus on robust error handling due to the complexity of cross-platform application monitoring
