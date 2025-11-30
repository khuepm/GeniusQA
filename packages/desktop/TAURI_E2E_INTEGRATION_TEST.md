# Tauri End-to-End Integration Testing Guide

This guide provides end-to-end integration testing procedures to verify the complete data flow through the Tauri architecture: Frontend → Tauri Backend → Python Core → Tauri Backend → Frontend.

## Architecture Overview

```
┌─────────────────────────────────────┐
│   React Frontend (TypeScript)       │
│  - RecorderScreen Component         │
│  - IPCBridgeService                 │
└──────────────┬──────────────────────┘
               │ invoke() / listen()
               ▼
┌─────────────────────────────────────┐
│   Tauri Backend (Rust)              │
│  - Command handlers                 │
│  - Python process manager           │
│  - Event emitter                    │
└──────────────┬──────────────────────┘
               │ stdin/stdout
               ▼
┌─────────────────────────────────────┐
│   Python Core (Python)              │
│  - Recorder module                  │
│  - Player module                    │
│  - Storage module                   │
└─────────────────────────────────────┘
```

## Integration Test Suite

### Test 1: Recording Flow Integration

**Objective:** Verify complete recording flow from UI to Python and back

**Test Steps:**

1. **Frontend → Tauri Backend**
   - User clicks "Record" button in RecorderScreen
   - RecorderScreen calls `ipcBridge.startRecording()`
   - IPCBridgeService invokes Tauri command `start_recording`
   
   **Verification:**
   - Check browser console for command invocation
   - Verify no errors in console

2. **Tauri Backend → Python Core**
   - Tauri backend receives `start_recording` command
   - Rust code sends JSON message to Python stdin: `{"command": "start_recording", "params": {}}`
   - Python Core receives and parses message
   
   **Verification:**
   - Check Tauri logs for command received
   - Check Python logs (stderr) for message received
   - Verify Python starts recording

3. **Python Core Processing**
   - Python Recorder module starts capturing events
   - PyAutoGUI/pynput listeners are activated
   - Actions are stored in memory
   
   **Verification:**
   - Perform test actions (mouse clicks, keyboard input)
   - Check Python logs for captured actions
   - Verify action count increases

4. **Stop Recording: Frontend → Tauri → Python**
   - User clicks "Stop" button
   - RecorderScreen calls `ipcBridge.stopRecording()`
   - Tauri sends `stop_recording` command to Python
   
   **Verification:**
   - Check console for command invocation
   - Check Tauri logs for command sent

5. **Python Core → Tauri Backend**
   - Python stops recording
   - Python saves script file to disk
   - Python sends response: `{"success": true, "data": {"scriptPath": "...", "actionCount": N, "duration": X}}`
   
   **Verification:**
   - Check Python logs for save operation
   - Verify file exists at ~/GeniusQA/recordings/
   - Check Tauri logs for response received

6. **Tauri Backend → Frontend**
   - Tauri parses Python response
   - Tauri returns RecordingResult to frontend
   - Frontend updates UI with success message
   
   **Verification:**
   - Check console for response received
   - Verify UI shows success message
   - Verify action count and file path displayed

**Expected End State:**
- Recording file exists on disk
- UI shows "Idle" status
- Start button is enabled
- Success message displayed

**Requirements Validated:** 1.1, 1.3, 1.4, 5.1, 5.2, 5.3, 6.1, 6.3

---

### Test 2: Playback Flow Integration

**Objective:** Verify complete playback flow with event streaming

**Test Steps:**

1. **Frontend → Tauri Backend**
   - User clicks "Start" button
   - RecorderScreen calls `ipcBridge.startPlayback()`
   - IPCBridgeService invokes `start_playback` with parameters
   
   **Verification:**
   - Check console for command invocation
   - Verify parameters (scriptPath, speed, loopCount)

2. **Tauri Backend → Python Core**
   - Tauri sends `start_playback` command with params
   - Python receives and parses command
   - Python loads script file from disk
   
   **Verification:**
   - Check Tauri logs for command sent
   - Check Python logs for file load
   - Verify script validation passes

3. **Python Core Processing**
   - Python Player module starts executing actions
   - For each action:
     - Python sends progress event to stdout
     - Python executes action via PyAutoGUI
     - Python respects timing delays
   
   **Verification:**
   - Observe actions executing on screen
   - Check Python logs for action execution
   - Verify timing is accurate

4. **Python Core → Tauri Backend (Events)**
   - Python emits progress events: `{"type": "progress", "data": {"currentAction": N, "totalActions": M}}`
   - Python emits action_preview events: `{"type": "action_preview", "data": {...}}`
   - Tauri receives events from Python stdout
   
   **Verification:**
   - Check Tauri logs for events received
   - Verify event parsing is correct
   - Check event frequency

5. **Tauri Backend → Frontend (Events)**
   - Tauri emits `python-event` to frontend
   - Frontend event listener receives events
   - IPCBridgeService dispatches to registered listeners
   
   **Verification:**
   - Check console for events received
   - Verify event data structure
   - Check event timing

6. **Frontend UI Updates**
   - RecorderScreen receives progress events
   - UI updates progress indicator
   - Visual preview shows current action
   
   **Verification:**
   - Observe progress bar updating
   - Verify action preview displays
   - Check UI responsiveness

7. **Playback Completion**
   - Python completes all actions
   - Python sends complete event: `{"type": "complete", "data": {}}`
   - Python sends success response
   
   **Verification:**
   - Check Python logs for completion
   - Check Tauri logs for complete event
   - Verify frontend receives completion

8. **Frontend Final State**
   - UI receives complete event
   - Status returns to "Idle"
   - Buttons return to initial state
   
   **Verification:**
   - Verify UI state is correct
   - Check console for state updates
   - Verify no errors occurred

**Expected End State:**
- All actions executed successfully
- UI shows "Idle" status
- Start button is enabled
- No errors in any layer

**Requirements Validated:** 2.1, 2.2, 2.4, 5.1, 5.3, 5.4, 7.1, 7.2, 7.3, 7.4

---

### Test 3: Error Propagation Integration

**Objective:** Verify errors propagate correctly through all layers

**Test Steps:**

1. **Python Error → Tauri → Frontend**
   - Trigger Python error (e.g., no recordings available)
   - Python sends error response: `{"success": false, "error": "No recordings found"}`
   - Tauri receives error response
   - Tauri rejects promise with error
   - Frontend catches error
   - UI displays error message
   
   **Verification:**
   - Check Python logs for error
   - Check Tauri logs for error handling
   - Check console for error caught
   - Verify error message displayed in UI

2. **Tauri Error → Frontend**
   - Trigger Tauri error (e.g., Python process not started)
   - Tauri rejects command promise
   - Frontend catches error
   - UI displays error message
   
   **Verification:**
   - Check Tauri logs for error
   - Check console for error caught
   - Verify error message displayed

3. **Python Process Crash**
   - Simulate Python process crash
   - Tauri detects process exit
   - Tauri notifies frontend
   - UI displays connection error
   
   **Verification:**
   - Check Tauri logs for process exit
   - Check console for error
   - Verify UI shows appropriate message

**Expected Behavior:**
- All errors are caught and handled
- User-friendly messages displayed
- No unhandled exceptions
- App remains stable

**Requirements Validated:** 5.5, 9.1, 9.2, 9.3, 9.4

---

### Test 4: Complete Recording → Editing → Playback Workflow

**Objective:** Verify end-to-end workflow with all features

**Test Steps:**

1. **Record a Session**
   - Start recording
   - Perform 10-15 actions
   - Stop recording
   - Verify file saved
   
   **Verification:**
   - File exists on disk
   - JSON is valid
   - Action count matches

2. **List Scripts**
   - Call `ipcBridge.listScripts()`
   - Verify recording appears in list
   
   **Verification:**
   - Script is in list
   - Metadata is correct

3. **Load Script for Editing**
   - Call `ipcBridge.loadScript(path)`
   - Verify script data returned
   
   **Verification:**
   - Script data is complete
   - Actions array is populated

4. **Edit Script**
   - Modify script data (e.g., change timing)
   - Call `ipcBridge.saveScript(path, data)`
   - Verify save succeeds
   
   **Verification:**
   - File is updated on disk
   - Changes are persisted

5. **Play Modified Script**
   - Call `ipcBridge.startPlayback(path, speed, loops)`
   - Observe playback with modifications
   
   **Verification:**
   - Modified script plays correctly
   - Changes are reflected in execution

6. **Delete Script**
   - Call `ipcBridge.deleteScript(path)`
   - Verify file is deleted
   
   **Verification:**
   - File no longer exists
   - Script not in list

**Expected End State:**
- Complete workflow executes without errors
- All operations succeed
- Data integrity maintained

**Requirements Validated:** All

---

## Integration Test Checklist

### Data Flow Verification

- [ ] Frontend commands reach Tauri backend
- [ ] Tauri commands reach Python Core
- [ ] Python responses reach Tauri backend
- [ ] Tauri responses reach frontend
- [ ] Python events reach Tauri backend
- [ ] Tauri events reach frontend
- [ ] Event data structure is preserved
- [ ] Error messages propagate correctly

### Process Management

- [ ] Python process starts on first command
- [ ] Python process stays alive between commands
- [ ] Python process handles multiple commands
- [ ] Python process cleanup on app exit
- [ ] Process restart after crash (if implemented)

### File System Integration

- [ ] Script files are created correctly
- [ ] Script files are readable by Python
- [ ] Script files are readable by frontend
- [ ] File paths are correct across platforms
- [ ] Directory creation works
- [ ] File deletion works

### Event Streaming

- [ ] Progress events stream in real-time
- [ ] Action preview events are received
- [ ] Complete events are received
- [ ] Error events are received
- [ ] Event order is preserved
- [ ] No event loss occurs

### Error Handling

- [ ] Python errors are caught
- [ ] Tauri errors are caught
- [ ] Frontend errors are caught
- [ ] Error messages are user-friendly
- [ ] App recovers from errors
- [ ] No data corruption on errors

## Debugging Integration Issues

### Enable Verbose Logging

1. **Frontend (Browser Console)**
   - Open DevTools
   - Check Console tab for logs
   - Look for IPC-related messages

2. **Tauri Backend**
   - Check terminal output when running `npm run tauri dev`
   - Look for Rust println! statements
   - Check for command/event logs

3. **Python Core**
   - Check stderr output (logged by Tauri)
   - Add debug prints to Python code
   - Check file system for script files

### Common Integration Issues

1. **Commands Not Reaching Python**
   - Check if Python process started
   - Verify stdin/stdout pipes are open
   - Check JSON serialization

2. **Events Not Reaching Frontend**
   - Verify Tauri event emission
   - Check event listener registration
   - Verify event name matches

3. **Data Corruption**
   - Check JSON parsing on both ends
   - Verify data types match
   - Check for encoding issues

4. **Timing Issues**
   - Add delays between operations
   - Check for race conditions
   - Verify async/await usage

## Performance Metrics

Track these metrics during integration testing:

- **Command Latency:** Time from frontend invoke to Python execution
- **Event Latency:** Time from Python emit to frontend receive
- **Throughput:** Number of events per second during playback
- **Memory Usage:** Monitor for memory leaks
- **CPU Usage:** Check for excessive CPU consumption

## Sign-off

After completing all integration tests:

- [ ] All data flows verified
- [ ] All error paths tested
- [ ] Performance is acceptable
- [ ] No memory leaks detected
- [ ] Cross-layer communication works correctly
- [ ] Ready for manual testing

**Tester Signature:** _______________
**Date:** _______________
