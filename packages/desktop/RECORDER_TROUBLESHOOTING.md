# Recorder Troubleshooting Guide

## Common Issues and Solutions

### Issue 1: Record Button Not Working

**Symptoms:**
- Click Record button but nothing happens
- No error message displayed
- Status remains "Idle"

**Possible Causes:**

1. **Python Process Not Starting**
   - Check console for error: "Failed to spawn Python process"
   - Solution: Ensure Python 3.9+ is installed
   ```bash
   python3 --version  # Should show 3.9 or higher
   ```

2. **Python Core Path Not Found**
   - In development: Check that `packages/python-core/src` exists
   - In production: Check that Python core is bundled with app
   - Solution: Verify directory structure

3. **Tauri Command Not Registered**
   - Check console for: "Command not found"
   - Solution: Ensure `start_recording` is in `invoke_handler!` in main.rs

4. **IPC Communication Failure**
   - Check console for: "Failed to write to Python stdin"
   - Solution: Restart the app to respawn Python process

**Debug Steps:**

1. Open browser DevTools (Right-click → Inspect)
2. Go to Console tab
3. Click Record button
4. Look for these log messages:
   ```
   [IPC Bridge] Invoking start_recording command...
   [IPC Bridge] start_recording command successful
   ```

5. If you see errors, check the error message:
   - "Python process not running" → Python failed to start
   - "Failed to spawn Python process" → Python not installed
   - "Permission denied" → Need Accessibility permissions (macOS)

### Issue 2: Python Dependencies Missing

**Symptoms:**
- Error: "No module named 'pyautogui'"
- Error: "No module named 'pynput'"

**Solution:**
```bash
cd packages/python-core
pip3 install -r requirements-recorder.txt
```

Or use the install script:
```bash
cd packages/python-core
./install-dependencies.sh
```

**Required Python packages:**
- pyautogui >= 0.9.53
- pynput >= 1.7.6
- pydantic >= 2.0.0
- Pillow >= 10.1.0

**Note:** Use `requirements-recorder.txt` (not `requirements.txt`) for minimal dependencies.

### Issue 3: Accessibility Permissions (macOS)

**Symptoms:**
- Error: "Permission denied. Please enable Accessibility permissions"
- Recording starts but no actions captured

**Solution:**
1. Open System Preferences → Security & Privacy → Privacy
2. Select "Accessibility" from left sidebar
3. Click the lock icon to make changes
4. Add your Terminal app or Tauri app to the list
5. Check the checkbox to enable
6. Restart the app

### Issue 4: No Recordings Found

**Symptoms:**
- Start button is disabled
- Message: "No recordings found"

**Possible Causes:**
1. No recordings have been created yet
2. Recordings directory doesn't exist
3. Recordings directory is empty

**Solution:**
1. Click Record button to create a recording
2. Perform some actions (move mouse, click, type)
3. Click Stop button to save
4. Start button should now be enabled

**Check recordings directory:**
```bash
ls -la ~/GeniusQA/recordings/
```

### Issue 5: Playback Not Working

**Symptoms:**
- Click Start button but nothing happens
- Status changes to "Playing" but no actions execute

**Possible Causes:**
1. Script file is corrupted
2. Python Core crashed during playback
3. Permissions issue

**Debug Steps:**
1. Check console for errors
2. Try recording a new session
3. Check if Python process is still running:
   ```bash
   ps aux | grep python
   ```

### Issue 6: Events Not Received

**Symptoms:**
- Playback starts but no progress updates
- No visual preview during playback
- No completion notification

**Possible Causes:**
1. Event listeners not initialized
2. Tauri events not being emitted
3. Event type mismatch

**Debug Steps:**
1. Check console for: `[IPC Bridge] Event listeners initialized`
2. Check console for: `[IPC Bridge] Received progress event:`
3. If no events, check Rust backend logs

**Solution:**
- Restart the app to reinitialize event listeners
- Check that event types match between Rust and TypeScript:
  - `progress`
  - `action_preview`
  - `complete`
  - `error`

## Debugging Tools

### Enable Verbose Logging

Add this to your code to see all IPC communication:

```typescript
// In RecorderScreen.tsx, add to useEffect:
console.log('[Recorder] Initializing...');
console.log('[Recorder] IPC Bridge:', ipcBridge);
console.log('[Recorder] Button states:', buttonStates);
```

### Check Python Process

```bash
# See if Python process is running
ps aux | grep "python.*__main__"

# Kill stuck Python process
pkill -f "python.*__main__"
```

### Check Recordings Directory

```bash
# List all recordings
ls -lh ~/GeniusQA/recordings/

# View a recording file
cat ~/GeniusQA/recordings/script_*.json | jq .

# Count actions in a recording
cat ~/GeniusQA/recordings/script_*.json | jq '.actions | length'
```

### Test Python Core Directly

```bash
cd packages/python-core/src
python3 -m __main__

# Then type commands:
{"command": "check_recordings", "params": {}}
{"command": "get_latest", "params": {}}
```

## Environment-Specific Issues

### macOS

**Issue:** "Operation not permitted"
- **Solution:** Enable Accessibility permissions (see Issue 3)

**Issue:** Python not found
- **Solution:** Install Python via Homebrew:
  ```bash
  brew install python@3.11
  ```

### Windows

**Issue:** Python not found
- **Solution:** Install Python from python.org
- Make sure to check "Add Python to PATH" during installation

**Issue:** PyAutoGUI not working
- **Solution:** May need to run as Administrator

### Linux

**Issue:** X11 vs Wayland
- **Solution:** PyAutoGUI works better with X11
- Switch to X11 session if using Wayland

**Issue:** Missing dependencies
- **Solution:** Install system packages:
  ```bash
  sudo apt-get install python3-tk python3-dev
  ```

## Performance Issues

### Slow Recording

**Symptoms:**
- Mouse movements feel laggy during recording
- High CPU usage

**Solution:**
- Reduce mouse move event frequency (edit Python Core)
- Close other applications

### Slow Playback

**Symptoms:**
- Actions execute slower than recorded

**Solution:**
- Use playback speed control (0.5x, 1x, 1.5x, 2x)
- Check system resources

## Getting Help

If you're still experiencing issues:

1. **Check Console Logs:**
   - Open DevTools → Console
   - Look for error messages with `[IPC Bridge]` or `[Recorder]` prefix

2. **Check Rust Logs:**
   - Run app from terminal to see Rust backend logs
   - Look for Python process spawn errors

3. **Verify Setup:**
   - Python 3.9+ installed: `python3 --version`
   - Dependencies installed: `pip list | grep -E "pyautogui|pynput|pydantic"`
   - Recordings directory exists: `ls ~/GeniusQA/recordings/`

4. **Test Components Separately:**
   - Test Python Core directly (see above)
   - Test Tauri commands from DevTools:
     ```javascript
     const { invoke } = window.__TAURI__.tauri;
     await invoke('check_recordings');
     ```

5. **Restart Everything:**
   - Close the app completely
   - Kill any stuck Python processes
   - Restart the app

## Known Limitations

1. **Recording Accuracy:**
   - Mouse movements are sampled, not continuous
   - Very fast actions may be missed
   - Timing accuracy: ±50ms

2. **Playback Limitations:**
   - Cannot interact with system dialogs
   - Cannot automate some protected applications
   - Requires same screen resolution for accurate positioning

3. **Platform Differences:**
   - Key codes may differ between platforms
   - Some actions may not work cross-platform
   - Permissions requirements vary by OS

## Reporting Bugs

When reporting issues, please include:

1. Operating system and version
2. Python version: `python3 --version`
3. Console logs (DevTools → Console)
4. Steps to reproduce
5. Expected vs actual behavior
6. Recording file (if applicable)

## Quick Fixes Checklist

- [ ] Python 3.9+ installed
- [ ] Python dependencies installed (`pip install -r requirements.txt`)
- [ ] Accessibility permissions enabled (macOS)
- [ ] Recordings directory exists (`~/GeniusQA/recordings/`)
- [ ] No stuck Python processes (`ps aux | grep python`)
- [ ] App restarted recently
- [ ] Console shows no errors
- [ ] DevTools open to see logs
