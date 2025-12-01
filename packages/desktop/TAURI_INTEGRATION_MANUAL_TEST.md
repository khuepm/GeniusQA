# Tauri Integration Manual Testing Guide

This guide provides comprehensive manual testing procedures for the Desktop Recorder MVP after migrating to Tauri's IPC architecture.

## Prerequisites

Before testing, ensure:
- Python 3.9+ is installed and accessible
- Python dependencies are installed: `pip install pyautogui pynput pydantic`
- Tauri development environment is set up
- macOS: Accessibility permissions granted for the app

## Test Environment Setup

1. Build the Tauri app:
```bash
cd packages/desktop
npm run tauri build
```

2. Or run in development mode:
```bash
cd packages/desktop
npm run tauri dev
```

## Test Suite

### 1. Recording Flow Tests

#### Test 1.1: Start Recording
**Objective:** Verify recording can be started successfully

**Steps:**
1. Launch the desktop app
2. Navigate to the Recorder screen
3. Click the "Record" button
4. Observe the UI state change

**Expected Results:**
- Record button becomes disabled
- Stop button becomes enabled
- Status displays "Recording"
- No error messages appear

**Requirements Validated:** 1.1, 1.2, 5.1

---

#### Test 1.2: Capture Actions During Recording
**Objective:** Verify user actions are captured

**Steps:**
1. Start recording (Test 1.1)
2. Perform various actions:
   - Move mouse around the screen
   - Click left mouse button 3-5 times
   - Type some text: "Hello World"
   - Press Enter key
3. Wait 2-3 seconds
4. Click "Stop" button

**Expected Results:**
- Recording stops successfully
- Success message displays with action count
- Script file path is shown
- Action count is > 0 (should capture all actions)

**Requirements Validated:** 1.1, 1.3, 1.4

---

#### Test 1.3: Save Recording
**Objective:** Verify recording is saved to disk

**Steps:**
1. Complete Test 1.2
2. Note the script file path from the success message
3. Navigate to ~/GeniusQA/recordings/ directory
4. Verify the script file exists

**Expected Results:**
- Script file exists at the specified path
- Filename format: `script_YYYYMMDD_HHMMSS.json`
- File contains valid JSON
- File includes metadata and actions array

**Requirements Validated:** 1.3, 1.4, 6.1, 6.3

---

#### Test 1.4: Stop Recording Without Actions
**Objective:** Verify recording can be stopped even with no actions

**Steps:**
1. Click "Record" button
2. Immediately click "Stop" button (within 1 second)
3. Observe the result

**Expected Results:**
- Recording stops successfully
- Script file is created
- Action count is 0 or very low
- No errors occur

**Requirements Validated:** 1.3, 1.4

---

### 2. Playback Flow Tests

#### Test 2.1: Start Playback (Most Recent)
**Objective:** Verify playback of most recent recording

**Steps:**
1. Ensure at least one recording exists (complete Test 1.2 if needed)
2. Click "Start" button
3. Observe the playback

**Expected Results:**
- Start button becomes disabled
- Stop button becomes enabled
- Status displays "Playing"
- Actions are replayed on screen
- Mouse moves and clicks are visible
- Keyboard inputs are executed

**Requirements Validated:** 2.1, 2.2, 5.1

---

#### Test 2.2: Playback Timing Accuracy
**Objective:** Verify timing is preserved during playback

**Steps:**
1. Record a sequence with deliberate pauses:
   - Click at position A
   - Wait 2 seconds
   - Click at position B
   - Wait 1 second
   - Click at position C
2. Play back the recording
3. Measure the delays between actions

**Expected Results:**
- Delays between actions match recording (±50ms)
- 2-second pause is preserved
- 1-second pause is preserved
- Actions execute in correct order

**Requirements Validated:** 2.2, 7.1, 7.2, 7.3, 7.4

---

#### Test 2.3: Stop Playback Mid-Execution
**Objective:** Verify playback can be interrupted

**Steps:**
1. Start playback of a long recording (>10 actions)
2. After 3-5 actions have executed, click "Stop" button
3. Observe the result

**Expected Results:**
- Playback stops immediately
- Remaining actions are not executed
- Status returns to "Idle"
- Start button becomes enabled again

**Requirements Validated:** 2.3, 5.1

---

#### Test 2.4: Playback Complete
**Objective:** Verify playback completes successfully

**Steps:**
1. Start playback of a short recording
2. Wait for all actions to complete
3. Observe the final state

**Expected Results:**
- All actions execute successfully
- Status returns to "Idle"
- Start button becomes enabled
- Completion message is displayed

**Requirements Validated:** 2.4

---

### 3. Script Selection and Management Tests

#### Test 3.1: List Available Scripts
**Objective:** Verify script listing functionality

**Steps:**
1. Create 3-5 different recordings
2. Open script selector (if implemented)
3. View the list of available scripts

**Expected Results:**
- All recorded scripts are listed
- Scripts show metadata (date, duration, action count)
- Scripts are sorted by date (newest first)

**Requirements Validated:** 6.5

---

#### Test 3.2: Select Specific Script for Playback
**Objective:** Verify specific script can be selected

**Steps:**
1. Ensure multiple recordings exist
2. Select a specific (not most recent) script
3. Start playback
4. Verify correct script is played

**Expected Results:**
- Selected script plays back
- Actions match the selected recording
- Not the most recent recording

**Requirements Validated:** 2.1, 6.5

---

### 4. Playback Speed Control Tests

#### Test 4.1: Half Speed Playback (0.5x)
**Objective:** Verify playback at half speed

**Steps:**
1. Create a recording with known timing
2. Set playback speed to 0.5x
3. Start playback
4. Measure execution time

**Expected Results:**
- Playback takes approximately 2x original duration
- Actions execute correctly
- Timing is proportionally slower

**Requirements Validated:** 2.2, 7.2

---

#### Test 4.2: Normal Speed Playback (1.0x)
**Objective:** Verify playback at normal speed

**Steps:**
1. Set playback speed to 1.0x
2. Start playback
3. Measure execution time

**Expected Results:**
- Playback matches original recording duration
- Timing is accurate (±50ms)

**Requirements Validated:** 2.2, 7.2, 7.4

---

#### Test 4.3: Double Speed Playback (2.0x)
**Objective:** Verify playback at double speed

**Steps:**
1. Set playback speed to 2.0x
2. Start playback
3. Measure execution time

**Expected Results:**
- Playback takes approximately 0.5x original duration
- Actions execute correctly
- Timing is proportionally faster

**Requirements Validated:** 2.2, 7.2

---

#### Test 4.4: Maximum Speed Playback (10x)
**Objective:** Verify playback at maximum speed

**Steps:**
1. Set playback speed to 10x (if supported)
2. Start playback
3. Observe execution

**Expected Results:**
- Playback executes very quickly
- All actions complete successfully
- No errors occur

**Requirements Validated:** 2.2

---

### 5. Loop/Repeat Functionality Tests

#### Test 5.1: Single Playback (1x)
**Objective:** Verify default single playback

**Steps:**
1. Set loop count to 1
2. Start playback
3. Wait for completion

**Expected Results:**
- Script plays once
- Playback stops after completion
- Status returns to "Idle"

**Requirements Validated:** 2.2, 2.4

---

#### Test 5.2: Multiple Loops (3x)
**Objective:** Verify multiple loop playback

**Steps:**
1. Set loop count to 3
2. Start playback
3. Count the number of repetitions

**Expected Results:**
- Script plays exactly 3 times
- Each loop is complete
- Playback stops after 3rd loop

**Requirements Validated:** 2.2

---

#### Test 5.3: Infinite Loop (0)
**Objective:** Verify infinite loop playback

**Steps:**
1. Set loop count to 0 (infinite)
2. Start playback
3. Let it run for 3-5 loops
4. Click "Stop" button

**Expected Results:**
- Script repeats continuously
- Must be manually stopped
- Stop button works correctly

**Requirements Validated:** 2.2, 2.3

---

#### Test 5.4: Stop During Loop
**Objective:** Verify stopping during multi-loop playback

**Steps:**
1. Set loop count to 5
2. Start playback
3. Stop during 2nd or 3rd loop

**Expected Results:**
- Playback stops immediately
- Remaining loops are cancelled
- Status returns to "Idle"

**Requirements Validated:** 2.3

---

### 6. Visual Preview Tests

#### Test 6.1: Action Preview Display
**Objective:** Verify visual preview shows current action

**Steps:**
1. Start playback
2. Observe the visual preview area
3. Watch as actions execute

**Expected Results:**
- Current action is highlighted
- Action details are displayed
- Preview updates in real-time

**Requirements Validated:** 5.4

---

#### Test 6.2: Progress Indicator
**Objective:** Verify progress is displayed

**Steps:**
1. Start playback of a recording with 20+ actions
2. Observe the progress indicator

**Expected Results:**
- Progress bar or counter is displayed
- Shows current action / total actions
- Updates as playback progresses

**Requirements Validated:** 5.4

---

### 7. Error Scenario Tests

#### Test 7.1: No Python Installed
**Objective:** Verify error handling when Python is unavailable

**Steps:**
1. Temporarily rename Python executable (or test on system without Python)
2. Try to start recording
3. Observe error message

**Expected Results:**
- Clear error message displayed
- Message mentions Python requirement
- Suggests installing Python 3.9+
- App doesn't crash

**Requirements Validated:** 8.4, 8.5, 9.4

---

#### Test 7.2: No Recordings Available
**Objective:** Verify handling when no recordings exist

**Steps:**
1. Delete all recordings from ~/GeniusQA/recordings/
2. Restart the app
3. Observe the UI state

**Expected Results:**
- Start button is disabled
- Message indicates no recordings available
- Record button is enabled
- Suggests recording a session first

**Requirements Validated:** 2.5, 9.2

---

#### Test 7.3: Corrupted Script File
**Objective:** Verify handling of corrupted files

**Steps:**
1. Create a recording
2. Manually corrupt the JSON file (invalid syntax)
3. Try to play the corrupted file

**Expected Results:**
- Clear error message displayed
- Message indicates file is corrupted
- Suggests creating a new recording
- App doesn't crash

**Requirements Validated:** 3.5, 9.3

---

#### Test 7.4: Permission Denied (macOS)
**Objective:** Verify handling of missing permissions

**Steps:**
1. On macOS, revoke Accessibility permissions
2. Try to start recording
3. Observe error message

**Expected Results:**
- Clear error message displayed
- Message mentions Accessibility permissions
- Provides guidance to enable permissions
- App doesn't crash

**Requirements Validated:** 9.1, 9.5

---

#### Test 7.5: Recording Already in Progress
**Objective:** Verify handling of concurrent recording attempts

**Steps:**
1. Start recording
2. Try to start another recording (if possible via API)
3. Observe error handling

**Expected Results:**
- Error message indicates recording in progress
- First recording continues unaffected
- No data corruption occurs

**Requirements Validated:** 9.1

---

#### Test 7.6: Playback Already in Progress
**Objective:** Verify handling of concurrent playback attempts

**Steps:**
1. Start playback
2. Try to start another playback (if possible via API)
3. Observe error handling

**Expected Results:**
- Error message indicates playback in progress
- First playback continues unaffected
- No interference occurs

**Requirements Validated:** 9.1

---

#### Test 7.7: Disk Full
**Objective:** Verify handling when disk is full

**Steps:**
1. Fill disk to near capacity (or simulate)
2. Try to save a recording
3. Observe error handling

**Expected Results:**
- Clear error message displayed
- Message indicates disk space issue
- Recording data is not corrupted
- App doesn't crash

**Requirements Validated:** 9.1

---

### 8. Cross-Platform Tests (if applicable)

#### Test 8.1: macOS Functionality
**Objective:** Verify all features work on macOS

**Steps:**
1. Run all above tests on macOS
2. Note any platform-specific issues

**Expected Results:**
- All features work correctly
- Accessibility permissions are handled
- No macOS-specific crashes

**Requirements Validated:** All

---

#### Test 8.2: Windows Functionality
**Objective:** Verify all features work on Windows

**Steps:**
1. Run all above tests on Windows
2. Note any platform-specific issues

**Expected Results:**
- All features work correctly
- No Windows-specific crashes
- File paths use correct separators

**Requirements Validated:** All

---

## Test Results Template

Use this template to document test results:

```
Test ID: [e.g., 1.1]
Test Name: [e.g., Start Recording]
Date: [YYYY-MM-DD]
Tester: [Name]
Platform: [macOS/Windows/Linux]
Result: [PASS/FAIL]
Notes: [Any observations or issues]
```

## Known Issues

Document any known issues discovered during testing:

1. [Issue description]
   - Severity: [Low/Medium/High/Critical]
   - Steps to reproduce: [...]
   - Workaround: [if any]

## Sign-off

After completing all tests:

- [ ] All critical tests passed
- [ ] All error scenarios handled gracefully
- [ ] Cross-platform testing completed (if applicable)
- [ ] Known issues documented
- [ ] Ready for production deployment

**Tester Signature:** _______________
**Date:** _______________
