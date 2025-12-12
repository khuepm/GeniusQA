# Rust Core - Expected Behavior

## Current Status

Rust Core is **available for selection** but **not yet fully implemented** for automation operations.

## What Works ✅

1. **Core Selection**
   - Rust Core shows as "Available" in UI
   - Can switch between Python and Rust cores
   - UI remains stable after switching
   - Core status is properly tracked

2. **Health Monitoring**
   - Health checks run for Rust core
   - Performance metrics are collected
   - Core comparison data is available

3. **Read-Only Operations**
   - Check for recordings (returns empty)
   - List scripts (returns empty array)
   - Get latest recording (returns null)

## What Doesn't Work (Expected) ⚠️

### Recording Operations
**Status:** Not Implemented

**When you try to record with Rust Core:**
```
Error: Rust Core does not support recording yet.

Please switch to Python Core to use recording features.

Click on "Python Core" in the Core Selector above.
```

**Commands affected:**
- Start Recording
- Stop Recording

### Playback Operations
**Status:** Not Implemented

**When you try to play with Rust Core:**
```
Error: Rust Core does not support playback yet.

Please switch to Python Core to use playback features.

Click on "Python Core" in the Core Selector above.
```

**Commands affected:**
- Start Playback
- Stop Playback
- Pause Playback

### Script Management
**Status:** Not Implemented

**When you try to manage scripts with Rust Core:**
```
Error: This feature is not yet available in Rust Core.

Please switch to Python Core to use this feature.

Click on "Python Core" in the Core Selector above.
```

**Commands affected:**
- Load Script
- Save Script
- Delete Script

## Fallback Behavior

When Rust Core operations fail, the system attempts to fallback to Python Core automatically.

**If Python Core is healthy:**
- Operation is retried with Python Core
- User sees success (transparent fallback)

**If Python Core is not healthy:**
```
Error: Rust Core does not support this operation yet, and Python Core is not available.

Please ensure Python Core is properly configured:
1. Python 3.9+ is installed (python3 --version)
2. Dependencies are installed (cd packages/python-core && pip3 install -r requirements.txt)
3. Restart the application

Then switch to Python Core to use this feature.
```

## User Workflow

### Recommended Workflow
1. **Use Python Core for all operations** (default)
2. Rust Core is available for testing and future use
3. Switch to Rust Core to verify it's available
4. Switch back to Python Core for actual work

### Testing Rust Core Availability
1. Open app (starts with Python Core by default)
2. Click on "Rust Core" in Core Selector
3. Verify UI remains visible
4. Verify "Rust Core" is marked as active
5. Try clicking "Record" button
6. See clear error message
7. Switch back to "Python Core"
8. Recording now works

## Error Messages

All error messages for Rust Core operations are:
- ✅ Clear and actionable
- ✅ Explain what's not working
- ✅ Tell user what to do next
- ✅ Guide user to switch to Python Core

## Implementation Status

### Phase 1: Core Infrastructure ✅ COMPLETE
- [x] Core availability detection
- [x] Core switching mechanism
- [x] Health monitoring
- [x] Performance tracking
- [x] Error handling and messaging

### Phase 2: Rust Core Operations ⏳ IN PROGRESS
- [ ] Recording implementation
- [ ] Playback implementation
- [ ] Script management
- [ ] Cross-core compatibility testing

### Phase 3: Feature Parity 📋 PLANNED
- [ ] All Python Core features in Rust Core
- [ ] Performance optimization
- [ ] Platform-specific enhancements
- [ ] Advanced automation features

## Developer Notes

### Why Rust Core Returns Errors

The current implementation intentionally returns clear error messages instead of silently failing or crashing. This provides:

1. **Better UX** - Users know exactly what's happening
2. **Clear Guidance** - Users know what to do next
3. **Stability** - App doesn't crash when trying unimplemented features
4. **Transparency** - Users understand Rust Core is work-in-progress

### Implementation in core_router.rs

```rust
fn route_to_rust(
    &self,
    command: AutomationCommand,
    _app_handle: &AppHandle,
) -> Result<serde_json::Value, String> {
    match command {
        AutomationCommand::StartRecording => {
            Err("Rust core recording not yet fully integrated. Please use Python core for recording.".to_string())
        }
        // ... other commands
    }
}
```

### Error Message Formatting in ipcBridgeService.ts

```typescript
if (message.includes('Rust core recording not yet fully integrated')) {
  return 'Rust Core does not support recording yet.\n\n' +
         'Please switch to Python Core to use recording features.\n\n' +
         'Click on "Python Core" in the Core Selector above.';
}
```

## Testing Checklist

### Manual Testing
- [x] App starts successfully
- [x] Rust Core shows as available
- [x] Can switch to Rust Core
- [x] UI remains visible after switch
- [x] Try recording with Rust Core
- [x] See clear error message
- [x] Switch back to Python Core
- [x] Recording works with Python Core

### Expected Results
- [x] No crashes
- [x] No blank screens
- [x] Clear error messages
- [x] Smooth core switching
- [x] Python Core remains fully functional

## Future Work

To complete Rust Core implementation:

1. **Implement rust_automation_core::recorder**
   - Capture mouse events
   - Capture keyboard events
   - Save to script format

2. **Implement rust_automation_core::player**
   - Load script files
   - Execute actions
   - Support speed control and looping

3. **Implement script management**
   - Load/save/delete operations
   - Ensure compatibility with Python scripts

4. **Cross-core testing**
   - Record with Python, play with Rust
   - Record with Rust, play with Python
   - Verify script format compatibility

## Summary

Rust Core is currently a **preview feature** that demonstrates:
- ✅ Core switching infrastructure works
- ✅ Health monitoring works
- ✅ Error handling is robust
- ⚠️ Actual automation operations not yet implemented

Users should continue using **Python Core for all automation work** until Rust Core implementation is complete.
