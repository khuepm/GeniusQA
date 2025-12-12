# macOS Permission Detection Testing Guide

This document describes how to test the macOS accessibility permission detection functionality.

## Overview

The Rust automation core now includes proper macOS accessibility permission detection using the native `AXIsProcessTrusted` and `AXIsProcessTrustedWithOptions` APIs from the ApplicationServices framework.

## Features Implemented

1. **Permission Checking**: Uses `AXIsProcessTrusted()` to check if the application has accessibility permissions
2. **Permission Request**: Uses `AXIsProcessTrustedWithOptions()` to trigger the system permission prompt
3. **Detailed Instructions**: Provides step-by-step instructions for granting permissions
4. **System Preferences Link**: Includes a direct link to open System Preferences
5. **Comprehensive Logging**: Logs all permission checks and requests with detailed metadata

## Testing Instructions

### Automated Tests

Run the unit tests to verify the basic functionality:

```bash
cargo test --manifest-path packages/rust-core/Cargo.toml --lib platform::macos::tests
```

These tests verify:
- Permission instructions contain all required information
- Permission checking returns a boolean result without panicking
- Platform name is correctly identified as "macos"

### Manual Testing

#### Test 1: Check Permissions (Denied State)

1. **Remove existing permissions** (if any):
   - Open System Preferences > Security & Privacy > Privacy > Accessibility
   - Find your application in the list
   - Uncheck the box or remove it from the list

2. **Run the application** and attempt to perform automation

3. **Expected behavior**:
   - `check_permissions()` should return `false`
   - Error message should include detailed instructions
   - Logs should show permission denial with metadata

#### Test 2: Request Permissions

1. **Start with no permissions** (see Test 1)

2. **Call `request_permissions()`** from the application

3. **Expected behavior**:
   - System should show a permission prompt dialog
   - Dialog should explain that the app wants to control your computer
   - User can click "Open System Preferences" to grant access

4. **Grant permissions** in System Preferences

5. **Verify**:
   - `check_permissions()` should now return `true`
   - Application should be able to perform automation

#### Test 3: Check Permissions (Granted State)

1. **Ensure permissions are granted** (see Test 2)

2. **Run the application** and attempt to perform automation

3. **Expected behavior**:
   - `check_permissions()` should return `true`
   - No error messages
   - Automation should work correctly
   - Logs should show successful permission check

### Permission Instructions Format

When permissions are denied, users receive instructions like:

```
To enable automation, please grant Accessibility permissions:

1. Open System Preferences (or System Settings on macOS 13+)
2. Navigate to Security & Privacy > Privacy > Accessibility
   (On macOS 13+: Privacy & Security > Accessibility)
3. Click the lock icon to make changes (you may need to enter your password)
4. Find this application in the list and check the box next to it
5. If the application is not in the list, click the '+' button to add it
6. Restart the application after granting permissions

Direct link: x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility

Note: These permissions are required for the application to control your mouse and keyboard.
```

## Implementation Details

### Key Functions

1. **`check_accessibility_permissions()`**: 
   - Uses `AXIsProcessTrusted()` to check current permission state
   - Returns `Result<bool>`
   - Logs the result with metadata

2. **`request_accessibility_permissions_with_prompt()`**:
   - Uses `AXIsProcessTrustedWithOptions()` with prompt option
   - Triggers system permission dialog
   - Logs the request with instructions

3. **`get_permission_instructions()`**:
   - Returns formatted instructions for granting permissions
   - Includes steps for both older and newer macOS versions
   - Provides direct System Preferences link

4. **`log_permission_denial()`**:
   - Logs detailed error information when permissions are denied
   - Includes instructions and system preferences link in metadata

### Logging Metadata

All permission-related operations include rich metadata:

```json
{
  "platform": "macos",
  "has_permissions": true/false,
  "required_permission": "Accessibility",
  "instructions": "...",
  "system_preferences_link": "x-apple.systempreferences:..."
}
```

## Requirements Validated

This implementation satisfies the following requirements from the spec:

- **Requirement 5.2**: Uses Core Graphics and Accessibility APIs for macOS automation
- **Requirement 5.5**: Detects and reports specific permission requirements when permissions are missing

## Notes

- The permission check is performed before any automation operations
- The system prompt can only be shown once per application launch
- Users must manually grant permissions in System Preferences
- After granting permissions, the application may need to be restarted
- The direct link to System Preferences works on macOS 10.10 and later

## Troubleshooting

### Permission prompt doesn't appear

- The prompt only appears once per application launch
- If already denied, users must manually go to System Preferences
- Try restarting the application

### Permissions granted but automation still fails

- Restart the application after granting permissions
- Verify the correct application is checked in System Preferences
- Check logs for other error messages

### System Preferences link doesn't work

- The link format may vary between macOS versions
- Manually navigate to System Preferences > Security & Privacy > Privacy > Accessibility
- On macOS 13+: System Settings > Privacy & Security > Accessibility
