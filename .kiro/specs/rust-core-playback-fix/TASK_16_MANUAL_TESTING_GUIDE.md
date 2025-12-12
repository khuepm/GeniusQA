# Task 16: Frontend Integration with Rust Playback - Manual Testing Guide

## Overview
This document provides comprehensive manual testing procedures for validating the Rust playback integration with the Tauri frontend. All subtasks must be tested to ensure proper functionality.

## Prerequisites
1. Build and run the desktop application:
   ```bash
   cd packages/desktop
   pnpm install
   pnpm tauri dev
   ```

2. Ensure you have at least one recorded script available for playback testing
3. Have the application running with access to both Python and Rust cores

---

## Subtask 16.1: Test Playback Start from Frontend

**Requirements:** 1.1, 1.2, 1.3, 2.1, 4.1

### Test Steps:

1. **Switch to Rust Core**
   - [ ] Open the Recorder Screen
   - [ ] Locate the "Automation Core" selector
   - [ ] Click on the "Rust Core" option
   - [ ] Verify the core switches successfully
   - [ ] Confirm "Active: 🦀 Rust Core" is displayed

2. **Start Playback with Default Settings**
   - [ ] Ensure a recorded script is available (record one if needed)
   - [ ] Click "Start Playback" button
   - [ ] Verify the button shows loading state
   - [ ] Confirm playback starts without errors

3. **Verify Mouse Cursor Moves**
   - [ ] Observe the mouse cursor during playback
   - [ ] Confirm cursor moves to recorded positions
   - [ ] Verify movements are smooth and accurate
   - [ ] Check that cursor reaches all recorded coordinates

4. **Verify Actions Execute**
   - [ ] Watch for mouse clicks being performed
   - [ ] Confirm keyboard inputs are typed
   - [ ] Verify all action types execute correctly:
     - Mouse movements
     - Mouse clicks (left, right, middle)
     - Keyboard key presses
     - Keyboard key releases

5. **Verify UI Updates with Progress**
   - [ ] Check that progress bar appears during playback
   - [ ] Confirm "Action X of Y" counter updates
   - [ ] Verify progress percentage increases
   - [ ] Check that action preview shows current action
   - [ ] Confirm preview displays:
     - Action type (e.g., "MOUSE_MOVE", "MOUSE_CLICK")
     - Coordinates (x, y)
     - Timestamp

### Expected Results:
- ✅ Core switches to Rust successfully
- ✅ Playback starts without errors
- ✅ Mouse cursor moves to recorded positions
- ✅ All actions execute correctly
- ✅ UI updates in real-time with progress information

### Error Cases to Test:
- [ ] Test with no recordings available (should show error)
- [ ] Test with corrupted script file (should show error message)
- [ ] Test switching cores during playback (should be disabled)

---

## Subtask 16.2: Test Playback Controls from Frontend

**Requirements:** 2.3, 2.4, 4.3, 8.5

### Test Steps:

1. **Test Pause During Playback**
   - [ ] Start playback with Rust core
   - [ ] Click "Pause" button during execution
   - [ ] Verify playback pauses immediately
   - [ ] Confirm UI shows "⏸ Paused" status
   - [ ] Check that progress bar stops updating
   - [ ] Verify mouse cursor stops moving

2. **Test Resume After Pause**
   - [ ] With playback paused, click "Resume" button
   - [ ] Verify playback continues from paused position
   - [ ] Confirm UI shows "▶ Playing" status
   - [ ] Check that progress bar resumes updating
   - [ ] Verify actions continue executing

3. **Test Stop During Playback**
   - [ ] Start playback with Rust core
   - [ ] Click "Stop Playback" button
   - [ ] Verify playback stops immediately
   - [ ] Confirm UI returns to idle state
   - [ ] Check that all progress indicators reset
   - [ ] Verify "Start Playback" button is enabled again

4. **Test UI State Updates**
   - [ ] Verify button states change correctly:
     - "Start Playback" disabled during playback
     - "Pause" enabled only during playback
     - "Stop Playback" enabled only during playback
   - [ ] Confirm status text updates correctly
   - [ ] Check that core selector is disabled during playback

5. **Test Control Responsiveness (< 100ms)**
   - [ ] Start playback
   - [ ] Click pause and measure response time
   - [ ] Click resume and measure response time
   - [ ] Click stop and measure response time
   - [ ] Verify all controls respond within 100ms

### Expected Results:
- ✅ Pause stops playback immediately
- ✅ Resume continues from paused position
- ✅ Stop terminates playback and cleans up
- ✅ UI state updates correctly for all controls
- ✅ All controls respond within 100ms

### Keyboard Shortcuts to Test:
- [ ] Press ESC during playback (should stop)
- [ ] Press ⌘+ESC during playback (should pause/resume on macOS)

---

## Subtask 16.3: Test Playback Speed Control from Frontend

**Requirements:** 2.2, 2.3

### Test Steps:

1. **Test 0.5x Speed**
   - [ ] Select "0.5x" speed button before playback
   - [ ] Start playback
   - [ ] Observe that actions execute at half speed
   - [ ] Verify timing delays are doubled
   - [ ] Confirm playback takes approximately 2x original duration

2. **Test 1.0x Speed (Normal)**
   - [ ] Select "1x" speed button
   - [ ] Start playback
   - [ ] Verify actions execute at normal speed
   - [ ] Confirm timing matches original recording
   - [ ] Check that playback duration matches recorded duration

3. **Test 2.0x Speed**
   - [ ] Select "2x" speed button
   - [ ] Start playback
   - [ ] Observe that actions execute at double speed
   - [ ] Verify timing delays are halved
   - [ ] Confirm playback takes approximately 0.5x original duration

4. **Test 5.0x Speed**
   - [ ] Select "5x" speed button
   - [ ] Start playback
   - [ ] Observe that actions execute at 5x speed
   - [ ] Verify timing delays are divided by 5
   - [ ] Confirm playback completes much faster

5. **Verify Timing Accuracy at Each Speed**
   - [ ] Record a script with known timing (e.g., 10 seconds)
   - [ ] Play back at each speed and measure actual duration:
     - 0.5x: Should take ~20 seconds
     - 1.0x: Should take ~10 seconds
     - 2.0x: Should take ~5 seconds
     - 5.0x: Should take ~2 seconds
   - [ ] Verify timing accuracy is within 10% tolerance

### Expected Results:
- ✅ 0.5x speed executes at half speed
- ✅ 1.0x speed matches original timing
- ✅ 2.0x speed executes at double speed
- ✅ 5.0x speed executes at 5x speed
- ✅ Timing accuracy is within acceptable tolerance

### Edge Cases to Test:
- [ ] Test speed changes between playback sessions
- [ ] Verify speed setting persists after app restart
- [ ] Test with very short scripts (< 1 second)
- [ ] Test with very long scripts (> 60 seconds)

---

## Subtask 16.4: Test Loop/Repeat Functionality from Frontend

**Requirements:** 2.1, 4.1

### Test Steps:

1. **Test Single Playback (Loop Count = 1)**
   - [ ] Select "Once" loop button
   - [ ] Start playback
   - [ ] Verify script plays exactly once
   - [ ] Confirm playback stops after completion
   - [ ] Check that loop counter shows "Loop 1 of 1"

2. **Test Multiple Loops (Loop Count = 3)**
   - [ ] Select "3x" loop button
   - [ ] Start playback
   - [ ] Verify script plays 3 times
   - [ ] Confirm loop counter updates: "Loop 1 of 3", "Loop 2 of 3", "Loop 3 of 3"
   - [ ] Check that playback stops after 3 loops

3. **Test Infinite Loop (Loop Count = 0)**
   - [ ] Select "∞" loop button
   - [ ] Start playback
   - [ ] Verify script continues looping
   - [ ] Confirm loop counter shows "Loop X (Infinite)"
   - [ ] Check that loop number increments continuously
   - [ ] Manually stop playback to verify it can be stopped

4. **Verify Loop Counter Updates in UI**
   - [ ] During multi-loop playback, watch loop counter
   - [ ] Confirm it updates at the start of each loop
   - [ ] Verify format is correct: "Loop X of Y"
   - [ ] Check that progress resets at start of each loop

5. **Verify Stop Works During Loops**
   - [ ] Start playback with 5 loops
   - [ ] Click stop during loop 2
   - [ ] Verify playback stops immediately
   - [ ] Confirm UI returns to idle state
   - [ ] Check that partial loop execution is handled correctly

### Expected Results:
- ✅ Single playback executes once and stops
- ✅ Multiple loops execute correct number of times
- ✅ Infinite loop continues until manually stopped
- ✅ Loop counter updates correctly in UI
- ✅ Stop works at any point during loops

### Additional Tests:
- [ ] Test loop count changes between playback sessions
- [ ] Verify loop setting persists after app restart
- [ ] Test pause/resume during multi-loop playback
- [ ] Test speed changes during multi-loop playback

---

## Subtask 16.5: Test Visual Preview During Playback

**Requirements:** 4.2

### Test Steps:

1. **Verify Action Preview Shows in UI**
   - [ ] Start playback
   - [ ] Confirm action preview card appears
   - [ ] Verify preview is visible and readable
   - [ ] Check that preview has appropriate styling
   - [ ] Confirm preview doesn't obstruct important UI elements

2. **Verify Preview Displays Action Type**
   - [ ] Observe preview during different action types
   - [ ] Confirm action types are displayed correctly:
     - "MOUSE_MOVE" for mouse movements
     - "MOUSE_CLICK" for clicks
     - "KEY_PRESS" for keyboard inputs
     - "KEY_RELEASE" for key releases
   - [ ] Verify action type is prominently displayed

3. **Verify Preview Displays Coordinates**
   - [ ] Watch preview during mouse actions
   - [ ] Confirm coordinates are shown (x, y)
   - [ ] Verify coordinates match actual cursor position
   - [ ] Check format: "Move mouse to (X, Y)" or "Click at (X, Y)"

4. **Verify Preview Updates for Each Action**
   - [ ] Observe preview throughout playback
   - [ ] Confirm preview updates for every action
   - [ ] Verify no actions are skipped in preview
   - [ ] Check that preview timing matches action execution

5. **Verify Progress Bar Updates Correctly**
   - [ ] Watch progress bar during playback
   - [ ] Confirm it fills from 0% to 100%
   - [ ] Verify progress matches action count
   - [ ] Check that progress percentage is accurate
   - [ ] Confirm progress bar color/style is appropriate

### Expected Results:
- ✅ Action preview appears during playback
- ✅ Action type is displayed correctly
- ✅ Coordinates are shown for mouse actions
- ✅ Preview updates for each action
- ✅ Progress bar updates smoothly and accurately

### Visual Elements to Verify:
- [ ] Preview card has appropriate opacity/transparency
- [ ] Preview includes action icon (🖱️, 👆, ⌨️)
- [ ] Timestamp is displayed if available
- [ ] Screenshot indicator shows when available
- [ ] Preview fades in/out smoothly

---

## Subtask 16.6: Test Error Handling in Frontend

**Requirements:** 4.4, 7.1, 7.2, 7.3, 7.4

### Test Steps:

1. **Test with Invalid Script Path**
   - [ ] Manually set an invalid script path
   - [ ] Attempt to start playback
   - [ ] Verify error message is displayed
   - [ ] Confirm error message is clear and helpful
   - [ ] Check that UI returns to idle state

2. **Test with Corrupted Script File**
   - [ ] Create a corrupted JSON file in recordings directory
   - [ ] Select the corrupted file
   - [ ] Attempt to start playback
   - [ ] Verify error message indicates parsing failure
   - [ ] Confirm UI handles error gracefully

3. **Test with Missing Permissions**
   - [ ] On macOS: Revoke Accessibility permissions
   - [ ] On Windows: Run without admin rights (if needed)
   - [ ] Attempt to start playback
   - [ ] Verify error message explains permission issue
   - [ ] Confirm error provides instructions to fix

4. **Verify Error Messages Display in UI**
   - [ ] For each error case, check that:
     - Error message appears in error container
     - Error text is red or otherwise highlighted
     - Error message is clear and actionable
     - Error doesn't crash the application

5. **Verify UI Returns to Idle State After Errors**
   - [ ] After each error, verify:
     - Status returns to "Idle"
     - "Start Playback" button is enabled
     - Progress indicators are reset
     - Error message can be dismissed
     - Core selector is enabled again

### Expected Results:
- ✅ Invalid script path shows appropriate error
- ✅ Corrupted file shows parsing error
- ✅ Missing permissions shows permission error
- ✅ All error messages are clear and helpful
- ✅ UI returns to idle state after all errors

### Additional Error Cases:
- [ ] Test with empty script file
- [ ] Test with script containing invalid actions
- [ ] Test with script from incompatible version
- [ ] Test network/file system errors
- [ ] Test concurrent playback attempts

---

## Overall Integration Tests

### Cross-Feature Tests:
1. **Record with Python, Play with Rust**
   - [ ] Switch to Python core
   - [ ] Record a script
   - [ ] Switch to Rust core
   - [ ] Play back the Python-recorded script
   - [ ] Verify cross-core compatibility

2. **Record with Rust, Play with Rust**
   - [ ] Switch to Rust core
   - [ ] Record a script
   - [ ] Play back the Rust-recorded script
   - [ ] Verify end-to-end Rust workflow

3. **Speed + Loop Combination**
   - [ ] Set speed to 2x
   - [ ] Set loops to 3
   - [ ] Start playback
   - [ ] Verify both settings work together

4. **Pause + Resume + Speed**
   - [ ] Start playback at 1x speed
   - [ ] Pause playback
   - [ ] Change speed to 2x
   - [ ] Resume playback
   - [ ] Verify speed change takes effect

### Performance Tests:
- [ ] Test with short script (< 10 actions)
- [ ] Test with medium script (10-100 actions)
- [ ] Test with long script (> 100 actions)
- [ ] Monitor CPU usage during playback
- [ ] Monitor memory usage during playback
- [ ] Verify no memory leaks after multiple playbacks

---

## Test Results Summary

### Subtask 16.1: Playback Start
- [ ] PASS
- [ ] FAIL (Details: _________________)

### Subtask 16.2: Playback Controls
- [ ] PASS
- [ ] FAIL (Details: _________________)

### Subtask 16.3: Speed Control
- [ ] PASS
- [ ] FAIL (Details: _________________)

### Subtask 16.4: Loop Functionality
- [ ] PASS
- [ ] FAIL (Details: _________________)

### Subtask 16.5: Visual Preview
- [ ] PASS
- [ ] FAIL (Details: _________________)

### Subtask 16.6: Error Handling
- [ ] PASS
- [ ] FAIL (Details: _________________)

---

## Known Issues / Notes

Document any issues found during testing:

1. Issue: _________________
   - Severity: [ ] Critical [ ] High [ ] Medium [ ] Low
   - Steps to reproduce: _________________
   - Expected behavior: _________________
   - Actual behavior: _________________

2. Issue: _________________
   - Severity: [ ] Critical [ ] High [ ] Medium [ ] Low
   - Steps to reproduce: _________________
   - Expected behavior: _________________
   - Actual behavior: _________________

---

## Sign-off

- [ ] All subtasks tested and documented
- [ ] All critical issues resolved or documented
- [ ] Integration with Rust playback verified
- [ ] Ready for production use

**Tester Name:** _________________
**Date:** _________________
**Signature:** _________________
