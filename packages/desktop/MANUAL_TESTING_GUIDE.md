# Desktop Recorder MVP - Manual Testing Guide

This guide provides comprehensive instructions for manually testing the Desktop Recorder MVP across different platforms, including permission setup, timing accuracy verification, and a complete testing checklist.

## Table of Contents

1. [Platform-Specific Setup](#platform-specific-setup)
2. [Permission Configuration](#permission-configuration)
3. [Testing Procedures](#testing-procedures)
4. [Timing Accuracy Verification](#timing-accuracy-verification)
5. [Testing Checklist](#testing-checklist)
6. [Troubleshooting](#troubleshooting)

---

## Platform-Specific Setup

### macOS Testing

#### Prerequisites
- macOS 10.14 (Mojave) or later
- Python 3.9 or higher installed
- Node.js 16+ and pnpm installed

#### Installation Steps
```bash
# Install Python dependencies
cd packages/python-core
pip install -r requirements.txt

# Install desktop app dependencies
cd ../desktop
pnpm install

# Build and run the desktop app
pnpm dev
```

#### macOS-Specific Considerations
- Accessibility permissions are required (see Permission Configuration)
- Screen Recording permission may be needed for certain operations
- Test with both Intel and Apple Silicon Macs if possible
- Verify behavior with multiple displays

### Windows Testing

#### Prerequisites
- Windows 10 or Windows 11
- Python 3.9 or higher installed
- Node.js 16+ and pnpm installed

#### Installation Steps
```bash
# Install Python dependencies
cd packages\python-core
pip install -r requirements.txt

# Install desktop app dependencies
cd ..\desktop
pnpm install

# Build and run the desktop app
pnpm dev
```

#### Windows-Specific Considerations
- Administrator privileges may be required for some automation tasks
- Test with different DPI scaling settings (100%, 125%, 150%, 200%)
- Verify behavior with multiple monitors
- Test on both Windows 10 and Windows 11 if possible
- Check compatibility with Windows Defender and antivirus software

### Linux Testing

#### Prerequisites
- Ubuntu 20.04+ or equivalent distribution
- Python 3.9 or higher installed
- Node.js 16+ and pnpm installed
- X11 or Wayland display server

#### Installation Steps
```bash
# Install system dependencies
sudo apt-get update
sudo apt-get install python3-tk python3-dev

# Install Python dependencies
cd packages/python-core
pip install -r requirements.txt

# Install desktop app dependencies
cd ../desktop
pnpm install

# Build and run the desktop app
pnpm dev
```

#### Linux-Specific Considerations
- Test on both X11 and Wayland (behavior may differ)
- Verify with different desktop environments (GNOME, KDE, XFCE)
- Check if xdotool is needed for certain operations
- Test with different window managers

---

## Permission Configuration

### macOS Permissions

#### Accessibility Permission (Required)
1. Open **System Preferences** → **Security & Privacy** → **Privacy**
2. Select **Accessibility** from the left sidebar
3. Click the lock icon and authenticate
4. Add the GeniusQA Desktop app to the list
5. Ensure the checkbox next to the app is enabled

#### Screen Recording Permission (May be Required)
1. Open **System Preferences** → **Security & Privacy** → **Privacy**
2. Select **Screen Recording** from the left sidebar
3. Click the lock icon and authenticate
4. Add the GeniusQA Desktop app to the list
5. Ensure the checkbox next to the app is enabled

#### Verification Steps
```bash
# Test if permissions are working
# Run the app and attempt to start recording
# If permissions are missing, macOS will show a system dialog
```

**Expected Behavior:**
- First launch should prompt for permissions
- App should display clear error messages if permissions are denied
- After granting permissions, app restart may be required

### Windows Permissions

#### Administrator Privileges (Optional)
Some automation tasks may require administrator privileges:

1. Right-click the GeniusQA Desktop app
2. Select **Run as administrator**
3. Confirm the UAC prompt

#### Windows Defender / Antivirus
If automation is blocked:

1. Open **Windows Security** → **Virus & threat protection**
2. Click **Manage settings** under "Virus & threat protection settings"
3. Add the GeniusQA app folder to exclusions
4. Restart the application

**Expected Behavior:**
- Most operations should work without administrator privileges
- Clear error messages should appear if privileges are insufficient

### Linux Permissions

#### X11 Permissions
No special permissions typically required for X11.

#### Wayland Considerations
Wayland has stricter security:

1. Some automation features may be limited
2. May need to run under XWayland compatibility layer
3. Check compositor-specific settings

**Expected Behavior:**
- App should detect if running under Wayland
- Clear error messages if operations are not supported

---

## Testing Procedures

### Test 1: Basic Recording Flow

**Objective:** Verify that basic recording functionality works correctly.

**Steps:**
1. Launch the GeniusQA Desktop app
2. Navigate to the Recorder screen
3. Click the **Record** button
4. Perform the following actions:
   - Move mouse to different screen positions
   - Click left mouse button 3 times
   - Click right mouse button 1 time
   - Type the text: "Hello World"
   - Press Enter key
5. Wait 2 seconds
6. Click the **Stop** button

**Expected Results:**
- Record button becomes disabled during recording
- Stop button becomes enabled during recording
- Status displays "Recording"
- After stopping, a success message appears
- Script file is created in `~/GeniusQA/recordings/`
- Filename follows format: `script_YYYYMMDD_HHMMSS.json`

**Verification:**
```bash
# Check if recording file was created
ls ~/GeniusQA/recordings/

# Inspect the JSON file
cat ~/GeniusQA/recordings/script_*.json | python -m json.tool
```

### Test 2: Basic Playback Flow

**Objective:** Verify that playback executes recorded actions correctly.

**Steps:**
1. Ensure at least one recording exists (complete Test 1 first)
2. Open a text editor or notepad application
3. Position the cursor in the text field
4. Return to GeniusQA Desktop app
5. Click the **Start** button
6. Observe the playback

**Expected Results:**
- Start button becomes disabled during playback
- Stop button becomes enabled during playback
- Status displays "Playing"
- Mouse moves to recorded positions
- Clicks occur at recorded locations
- Keyboard inputs are typed correctly
- Timing between actions is preserved
- After completion, status returns to "Idle"

### Test 3: Recording Interruption

**Objective:** Verify that recording can be stopped mid-session.

**Steps:**
1. Click the **Record** button
2. Perform 2-3 mouse movements
3. Immediately click the **Stop** button
4. Check that a script file was created

**Expected Results:**
- Recording stops immediately
- Script file is saved with captured actions
- File contains only the actions performed before stopping
- No errors are displayed

### Test 4: Playback Interruption

**Objective:** Verify that playback can be stopped mid-execution.

**Steps:**
1. Create a recording with at least 10 actions
2. Click the **Start** button to begin playback
3. After 2-3 actions have executed, click **Stop**

**Expected Results:**
- Playback stops immediately
- No further actions are executed
- Status returns to "Idle"
- No errors are displayed

### Test 5: No Recordings Available

**Objective:** Verify behavior when no recordings exist.

**Steps:**
1. Delete all files from `~/GeniusQA/recordings/`
2. Restart the GeniusQA Desktop app
3. Navigate to Recorder screen

**Expected Results:**
- Start button is disabled
- Record button is enabled
- Status shows "Idle"
- Message indicates no recordings available

### Test 6: Multiple Recordings

**Objective:** Verify that the system correctly identifies the latest recording.

**Steps:**
1. Create recording #1, wait 5 seconds
2. Create recording #2, wait 5 seconds
3. Create recording #3
4. Click **Start** button

**Expected Results:**
- Playback uses recording #3 (most recent)
- Verify by checking which actions are executed

### Test 7: Long Recording Session

**Objective:** Test system stability with extended recording.

**Steps:**
1. Click **Record** button
2. Perform various actions for 2-3 minutes:
   - Mouse movements
   - Clicks
   - Typing
   - Scrolling
3. Click **Stop** button

**Expected Results:**
- All actions are captured
- File size is reasonable (check JSON file)
- No memory leaks or performance degradation
- Playback executes all actions correctly

### Test 8: Complex Action Sequences

**Objective:** Verify accurate capture of complex interactions.

**Steps:**
1. Click **Record** button
2. Perform the following sequence:
   - Open a web browser
   - Navigate to a website
   - Fill out a form with multiple fields
   - Click submit button
   - Close the browser
3. Click **Stop** button
4. Click **Start** button to replay

**Expected Results:**
- All actions are captured in correct order
- Playback reproduces the exact sequence
- Form fields are filled correctly
- Timing is preserved

---

## Timing Accuracy Verification

### Test 1: Short Delays (< 1 second)

**Objective:** Verify timing accuracy for quick actions.

**Setup:**
1. Create a recording with actions spaced 100-500ms apart
2. Use a stopwatch or timer application

**Procedure:**
1. Start recording
2. Click at position A
3. Wait exactly 200ms (use metronome or timer)
4. Click at position B
5. Wait exactly 500ms
6. Click at position C
7. Stop recording
8. Start playback and measure actual delays

**Expected Results:**
- Delays should be within ±50ms of recorded times
- 200ms delay: actual should be 150-250ms
- 500ms delay: actual should be 450-550ms

**Verification Method:**
```python
# Inspect the JSON file timestamps
import json

with open('~/GeniusQA/recordings/script_*.json', 'r') as f:
    data = json.load(f)
    actions = data['actions']
    
    for i in range(len(actions) - 1):
        delay = actions[i+1]['timestamp'] - actions[i]['timestamp']
        print(f"Delay between action {i} and {i+1}: {delay*1000:.2f}ms")
```

### Test 2: Medium Delays (1-5 seconds)

**Objective:** Verify timing accuracy for moderate delays.

**Procedure:**
1. Create recording with 1s, 2s, 3s, and 5s delays
2. Use a stopwatch during playback
3. Measure actual delays

**Expected Results:**
- All delays within ±50ms of recorded times
- 1s delay: 950-1050ms
- 2s delay: 1950-2050ms
- 3s delay: 2950-3050ms
- 5s delay: 4950-5050ms

### Test 3: Long Delays (> 5 seconds)

**Objective:** Verify that long delays are capped at 5 seconds.

**Procedure:**
1. Create recording with 10s, 20s, and 30s delays
2. Measure playback delays with stopwatch

**Expected Results:**
- All delays capped at 5 seconds maximum
- 10s recorded delay → 5s actual delay
- 20s recorded delay → 5s actual delay
- 30s recorded delay → 5s actual delay

**Verification:**
```bash
# Check the design document confirms this behavior
# Property 5: Long delay capping
```

### Test 4: Rapid Action Sequences

**Objective:** Verify accuracy with very fast actions.

**Procedure:**
1. Create recording with actions < 50ms apart
2. Type rapidly or perform quick mouse clicks
3. Verify playback maintains the rapid pace

**Expected Results:**
- Rapid sequences are preserved
- No artificial delays added
- Actions execute as quickly as recorded

---

## Testing Checklist

### Pre-Testing Setup

- [ ] Python 3.9+ installed and verified (`python --version`)
- [ ] PyAutoGUI installed (`pip list | grep pyautogui`)
- [ ] pynput installed (`pip list | grep pynput`)
- [ ] Node.js 16+ installed (`node --version`)
- [ ] pnpm installed (`pnpm --version`)
- [ ] All dependencies installed (`pnpm install`)
- [ ] Recordings directory exists or can be created

### Platform-Specific Checks

#### macOS
- [ ] Accessibility permissions granted
- [ ] Screen Recording permissions granted (if needed)
- [ ] Tested on Intel Mac
- [ ] Tested on Apple Silicon Mac
- [ ] Tested with multiple displays

#### Windows
- [ ] Tested on Windows 10
- [ ] Tested on Windows 11
- [ ] Tested with 100% DPI scaling
- [ ] Tested with 125% DPI scaling
- [ ] Tested with 150% DPI scaling
- [ ] Tested with multiple monitors
- [ ] Antivirus exclusions configured (if needed)

#### Linux
- [ ] Tested on X11
- [ ] Tested on Wayland (if applicable)
- [ ] Tested on Ubuntu/Debian
- [ ] Tested on Fedora/RHEL (if applicable)
- [ ] System dependencies installed

### Functional Testing

#### Recording
- [ ] Test 1: Basic recording flow completed
- [ ] Test 3: Recording interruption works
- [ ] Test 7: Long recording session stable
- [ ] Test 8: Complex action sequences captured
- [ ] Mouse movements recorded accurately
- [ ] Mouse clicks (left, right, middle) recorded
- [ ] Keyboard inputs recorded correctly
- [ ] Special keys recorded (Enter, Tab, Esc, etc.)
- [ ] Script file created with correct filename format
- [ ] Script file contains valid JSON
- [ ] Metadata includes version, timestamp, duration, action count

#### Playback
- [ ] Test 2: Basic playback flow works
- [ ] Test 4: Playback interruption works
- [ ] Test 6: Latest recording identified correctly
- [ ] Actions execute in correct order
- [ ] Mouse movements accurate
- [ ] Mouse clicks accurate
- [ ] Keyboard inputs accurate
- [ ] Timing preserved within 50ms

#### UI/UX
- [ ] Record button enabled when idle
- [ ] Record button disabled when recording/playing
- [ ] Start button enabled when idle with recordings
- [ ] Start button disabled when no recordings
- [ ] Start button disabled when recording/playing
- [ ] Stop button enabled when recording
- [ ] Stop button enabled when playing
- [ ] Stop button disabled when idle
- [ ] Status displays correctly (Idle/Recording/Playing)
- [ ] Error messages are clear and actionable

#### Storage
- [ ] Recordings directory auto-created
- [ ] Files saved with timestamp-based names
- [ ] Multiple recordings can coexist
- [ ] Latest recording identified correctly
- [ ] Files are valid JSON
- [ ] Files can be opened and inspected manually

#### Error Handling
- [ ] Test 5: No recordings scenario handled
- [ ] Missing permissions detected and reported
- [ ] Python Core unavailable detected
- [ ] Corrupted script file detected
- [ ] Disk full scenario handled gracefully
- [ ] Invalid JSON handled gracefully
- [ ] Error messages are user-friendly

### Timing Accuracy

- [ ] Short delays (< 1s) within ±50ms
- [ ] Medium delays (1-5s) within ±50ms
- [ ] Long delays (> 5s) capped at 5s
- [ ] Rapid sequences preserved
- [ ] No artificial delays added

### IPC Communication

- [ ] Python process starts successfully
- [ ] Commands sent correctly
- [ ] Responses received correctly
- [ ] Events propagated correctly
- [ ] Errors propagated correctly
- [ ] Process cleanup on app exit

### Cross-Platform Compatibility

- [ ] Same script file works on all platforms
- [ ] JSON format is platform-independent
- [ ] Metadata includes platform information
- [ ] No platform-specific bugs

### Performance

- [ ] Recording doesn't impact system performance
- [ ] Playback doesn't impact system performance
- [ ] Large script files (>1000 actions) handled
- [ ] No memory leaks during extended use
- [ ] UI remains responsive during operations

### Security

- [ ] Script files stored locally only
- [ ] No sensitive data logged
- [ ] File paths validated (no directory traversal)
- [ ] User warned about running untrusted scripts (future)

---

## Troubleshooting

### Common Issues

#### Issue: "Permission Denied" Error on macOS

**Symptoms:**
- Recording fails to start
- Error message about permissions

**Solution:**
1. Open System Preferences → Security & Privacy → Privacy
2. Grant Accessibility permissions
3. Grant Screen Recording permissions
4. Restart the application

#### Issue: PyAutoGUI Not Found

**Symptoms:**
- Python Core fails to start
- Error message about missing PyAutoGUI

**Solution:**
```bash
pip install pyautogui pynput
```

#### Issue: Recording File Not Created

**Symptoms:**
- Recording completes but no file appears
- Error about file system

**Solution:**
1. Check disk space: `df -h`
2. Check directory permissions: `ls -la ~/GeniusQA/`
3. Manually create directory: `mkdir -p ~/GeniusQA/recordings`

#### Issue: Playback Actions in Wrong Location

**Symptoms:**
- Mouse clicks occur at incorrect positions
- Actions don't match recording

**Possible Causes:**
- Different screen resolution between recording and playback
- Multiple monitors with different configurations
- DPI scaling differences (Windows)

**Solution:**
- Record and playback on same system configuration
- Check display settings match
- Verify DPI scaling is consistent

#### Issue: Timing Inaccurate

**Symptoms:**
- Actions too fast or too slow
- Delays don't match recording

**Solution:**
1. Check system load (high CPU may affect timing)
2. Close other applications
3. Verify Python Core is not throttled
4. Check JSON file timestamps are correct

#### Issue: Python Process Won't Start

**Symptoms:**
- IPC Bridge fails
- Connection timeout errors

**Solution:**
1. Verify Python is in PATH: `which python` or `where python`
2. Check Python version: `python --version` (must be 3.9+)
3. Verify script location: `ls packages/python-core/src/__main__.py`
4. Check for Python errors: Look at stderr output

#### Issue: Keyboard Input Not Working

**Symptoms:**
- Mouse works but keyboard doesn't
- Keys not recorded or not played back

**Solution:**
1. Check keyboard permissions (macOS)
2. Verify pynput is installed: `pip list | grep pynput`
3. Test with simple keys first (letters, numbers)
4. Check for keyboard layout differences

### Debug Mode

To enable verbose logging:

```bash
# Set environment variable before running
export DEBUG=true
pnpm dev
```

Check logs:
- React Native: Check console output
- Python Core: Check stderr output
- IPC Messages: Enable IPC logging in bridge service

### Getting Help

If issues persist:

1. Check the main README: `packages/desktop/RECORDER_README.md`
2. Review IPC Protocol: `packages/python-core/IPC_PROTOCOL.md`
3. Check integration tests: `packages/desktop/INTEGRATION_TESTS_RECORDER.md`
4. Review requirements: `.kiro/specs/desktop-recorder-mvp/requirements.md`
5. Review design: `.kiro/specs/desktop-recorder-mvp/design.md`

---

## Test Report Template

Use this template to document your testing results:

```markdown
# Desktop Recorder MVP - Test Report

**Date:** YYYY-MM-DD
**Tester:** [Name]
**Platform:** [macOS/Windows/Linux]
**OS Version:** [Version]
**Python Version:** [Version]
**Node Version:** [Version]

## Test Summary

- Total Tests: X
- Passed: X
- Failed: X
- Blocked: X

## Platform-Specific Results

### macOS
- [ ] All tests passed
- [ ] Issues found: [List]

### Windows
- [ ] All tests passed
- [ ] Issues found: [List]

### Linux
- [ ] All tests passed
- [ ] Issues found: [List]

## Detailed Results

### Test 1: Basic Recording Flow
- Status: [Pass/Fail/Blocked]
- Notes: [Any observations]

### Test 2: Basic Playback Flow
- Status: [Pass/Fail/Blocked]
- Notes: [Any observations]

[Continue for all tests...]

## Timing Accuracy Results

| Test | Expected | Actual | Pass/Fail |
|------|----------|--------|-----------|
| 200ms delay | 150-250ms | Xms | Pass/Fail |
| 500ms delay | 450-550ms | Xms | Pass/Fail |
| 1s delay | 950-1050ms | Xms | Pass/Fail |
| 5s delay | 4950-5050ms | Xms | Pass/Fail |
| 10s delay (capped) | ~5000ms | Xms | Pass/Fail |

## Issues Found

1. **Issue Title**
   - Severity: [Critical/High/Medium/Low]
   - Description: [Details]
   - Steps to Reproduce: [Steps]
   - Expected: [Expected behavior]
   - Actual: [Actual behavior]
   - Platform: [Affected platforms]

## Recommendations

[Any suggestions for improvements or fixes]

## Sign-off

- [ ] All critical tests passed
- [ ] All high-priority tests passed
- [ ] Known issues documented
- [ ] Ready for release: [Yes/No]

**Tester Signature:** _______________
**Date:** _______________
```

---

## Appendix: Quick Reference

### File Locations

- **Recordings Directory:** `~/GeniusQA/recordings/`
- **Python Core:** `packages/python-core/`
- **Desktop App:** `packages/desktop/`
- **IPC Protocol:** `packages/python-core/IPC_PROTOCOL.md`

### Key Commands

```bash
# Run desktop app
cd packages/desktop && pnpm dev

# Run Python tests
cd packages/python-core && pytest

# Run desktop tests
cd packages/desktop && pnpm test

# Check recording files
ls -la ~/GeniusQA/recordings/

# Validate JSON
cat ~/GeniusQA/recordings/script_*.json | python -m json.tool

# Clean recordings
rm ~/GeniusQA/recordings/*.json
```

### Expected File Format

```json
{
  "metadata": {
    "version": "1.0",
    "created_at": "2024-01-01T12:00:00Z",
    "duration": 45.5,
    "action_count": 127,
    "platform": "darwin"
  },
  "actions": [
    {
      "type": "mouse_move",
      "timestamp": 0.0,
      "x": 100,
      "y": 200
    }
  ]
}
```
