# Task 17.1: Test Python-recorded Scripts with Rust Playback

## Overview
This document provides a manual testing guide for validating that scripts recorded with the Python core can be successfully played back with the Rust core.

**Requirements:** 10.1

## Prerequisites
- Desktop application running
- Both Python and Rust cores available
- Test environment with screen access
- Permissions granted for automation (macOS Accessibility, etc.)

## Test Procedure

### Step 1: Record a Script with Python Core

1. **Launch the Desktop Application**
   ```bash
   cd packages/desktop
   pnpm run tauri dev
   ```

2. **Switch to Python Core**
   - In the application UI, locate the Core Selector
   - Select "Python Core" from the dropdown
   - Verify the status shows "Python Core Active"

3. **Record a Test Script**
   - Click the "Start Recording" button
   - Perform the following actions:
     - Move mouse to position (100, 100)
     - Click left mouse button
     - Type "hello"
     - Press Tab key
     - Move mouse to position (200, 200)
     - Click left mouse button
     - Type "world"
     - Press Enter key
   - Click "Stop Recording"
   - Save the script with name: `python_recorded_test_1`

4. **Verify Script File**
   - Locate the saved script file (typically in user's scripts directory)
   - Open the JSON file and verify it contains:
     - Metadata with `platform` field
     - Array of actions with timestamps
     - Mouse move actions with x, y coordinates
     - Mouse click actions with button type
     - Key press actions with key names

### Step 2: Switch to Rust Core

1. **Change Core Selection**
   - In the application UI, locate the Core Selector
   - Select "Rust Core" from the dropdown
   - Verify the status shows "Rust Core Active"

2. **Verify Core Switch**
   - Check that no errors appear in the UI
   - Verify the recorder is in idle state
   - Confirm playback controls are available

### Step 3: Play Back Python-Recorded Script with Rust Core

1. **Load the Script**
   - In the Script Selector, find `python_recorded_test_1`
   - Select the script
   - Verify script details are displayed (action count, duration)

2. **Start Playback**
   - Click the "Play" button
   - Observe the following:
     - Mouse cursor moves to (100, 100)
     - Mouse click occurs at that position
     - Text "hello" is typed
     - Tab key is pressed
     - Mouse cursor moves to (200, 200)
     - Mouse click occurs at that position
     - Text "world" is typed
     - Enter key is pressed

3. **Verify Playback Execution**
   - All actions should execute in the correct order
   - Timing between actions should be respected
   - No errors should appear in the UI
   - Progress bar should update during playback
   - Action preview should show each action before execution

4. **Check Playback Completion**
   - Verify playback completes successfully
   - Check completion message in UI
   - Verify statistics are displayed (actions executed, duration, etc.)

### Step 4: Test Different Action Types

#### Test 4.1: Mouse Actions Only

1. Record with Python Core:
   - Mouse move to (50, 50)
   - Left click
   - Mouse move to (150, 150)
   - Right click
   - Mouse move to (250, 250)
   - Middle click

2. Switch to Rust Core and play back
3. Verify all mouse actions execute correctly

#### Test 4.2: Keyboard Actions Only

1. Record with Python Core:
   - Type "username"
   - Press Tab
   - Type "password"
   - Press Enter

2. Switch to Rust Core and play back
3. Verify all keyboard actions execute correctly

#### Test 4.3: Mixed Actions

1. Record with Python Core:
   - Mouse move and click on text field
   - Type some text
   - Press keyboard shortcuts (Ctrl+A, Ctrl+C)
   - Mouse move and click elsewhere
   - Press keyboard shortcuts (Ctrl+V)

2. Switch to Rust Core and play back
3. Verify all actions execute correctly in sequence

### Step 5: Test Edge Cases

#### Test 5.1: Edge Coordinates

1. Record with Python Core:
   - Mouse move to (0, 0) - top-left corner
   - Mouse move to screen bottom-right corner
   - Mouse move to screen center

2. Switch to Rust Core and play back
3. Verify coordinates are handled correctly (clamped if necessary)

#### Test 5.2: Rapid Actions

1. Record with Python Core:
   - Perform rapid mouse movements
   - Perform rapid key presses

2. Switch to Rust Core and play back
3. Verify timing is preserved and actions execute

#### Test 5.3: Special Keys

1. Record with Python Core:
   - Press special keys: Escape, F1-F12, Home, End, Page Up, Page Down
   - Press modifier combinations: Ctrl+C, Alt+Tab, Shift+Arrow

2. Switch to Rust Core and play back
3. Verify special keys are handled correctly

### Step 6: Test Playback Controls

1. **Test Pause/Resume**
   - Start playback of Python-recorded script with Rust core
   - Click "Pause" during playback
   - Verify playback pauses
   - Click "Resume"
   - Verify playback continues from paused position

2. **Test Stop**
   - Start playback of Python-recorded script with Rust core
   - Click "Stop" during playback
   - Verify playback stops immediately
   - Verify UI returns to idle state

3. **Test Speed Control**
   - Play back at 0.5x speed - verify slower execution
   - Play back at 1.0x speed - verify normal execution
   - Play back at 2.0x speed - verify faster execution
   - Play back at 5.0x speed - verify very fast execution

4. **Test Loop/Repeat**
   - Set loop count to 3
   - Start playback
   - Verify script plays 3 times
   - Verify loop counter updates in UI

### Step 7: Test Error Handling

1. **Test with Invalid Script**
   - Manually corrupt a Python-recorded script JSON file
   - Try to play back with Rust core
   - Verify error message is displayed
   - Verify UI returns to idle state

2. **Test with Missing Permissions**
   - Revoke automation permissions (if possible on your platform)
   - Try to play back Python-recorded script with Rust core
   - Verify permission error is displayed with helpful message

3. **Test with Out-of-Bounds Coordinates**
   - Manually edit a Python-recorded script to have coordinates outside screen bounds
   - Play back with Rust core
   - Verify coordinates are clamped and warning is logged

## Expected Results

### Compatibility
- ✅ All Python-recorded scripts should load successfully in Rust core
- ✅ All compatible action types should execute correctly
- ✅ Script metadata should be preserved
- ✅ Timing information should be respected

### Action Execution
- ✅ Mouse movements should move cursor to correct positions
- ✅ Mouse clicks should occur at correct positions with correct buttons
- ✅ Keyboard input should type correct text
- ✅ Special keys should be pressed correctly

### UI Feedback
- ✅ Progress updates should appear during playback
- ✅ Action previews should show before each action
- ✅ Completion message should appear when done
- ✅ Statistics should be accurate

### Error Handling
- ✅ Invalid scripts should show clear error messages
- ✅ Permission errors should provide helpful guidance
- ✅ Edge cases should be handled gracefully

## Validation Checklist

- [ ] Python-recorded script loads in Rust core
- [ ] All mouse actions execute correctly
- [ ] All keyboard actions execute correctly
- [ ] Mixed actions execute in correct order
- [ ] Timing is preserved during playback
- [ ] Edge coordinates are handled correctly
- [ ] Special keys work correctly
- [ ] Pause/resume works correctly
- [ ] Stop works correctly
- [ ] Speed control works correctly
- [ ] Loop/repeat works correctly
- [ ] Error messages are clear and helpful
- [ ] UI updates correctly during playback
- [ ] No crashes or unexpected behavior

## Known Limitations

1. **Platform-Specific Actions**: Some actions may be platform-specific and not work on all operating systems
2. **Timing Precision**: Exact timing may vary slightly due to system load
3. **Screen Resolution**: Scripts recorded on different screen resolutions may need coordinate adjustment

## Troubleshooting

### Issue: Script doesn't load
- **Solution**: Check JSON format is valid, verify file permissions

### Issue: Actions don't execute
- **Solution**: Check automation permissions, verify Rust core is active

### Issue: Timing is off
- **Solution**: Check system load, try adjusting playback speed

### Issue: Coordinates are wrong
- **Solution**: Verify screen resolution matches recording environment

## Test Results

**Date:** _________________

**Tester:** _________________

**Platform:** _________________

**Test Status:** ⬜ Pass ⬜ Fail ⬜ Partial

**Notes:**
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________

**Issues Found:**
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________

## Automated Test Coverage

The following automated tests also validate Python-to-Rust compatibility:

- `packages/rust-core/tests/python_to_rust_playback_test.rs`
  - `test_load_python_recorded_script`
  - `test_python_mouse_actions_compatibility`
  - `test_python_keyboard_actions_compatibility`
  - `test_python_mixed_actions_compatibility`
  - `test_cross_core_compatibility_validation`
  - And more...

Run automated tests:
```bash
cd packages/rust-core
cargo test python_to_rust
```

## Conclusion

This manual testing procedure validates that Python-recorded scripts work correctly with Rust playback, ensuring cross-core compatibility as specified in Requirement 10.1.
