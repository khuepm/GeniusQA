# Broken Pipe Fix - Final Solution

## Problem

Error when clicking Record button:
```
[IPC Bridge] start_recording command failed: "Failed to write to Python stdin: Broken pipe (os error 32)"
```

## Root Causes Found

### 1. Python Dependencies Not Installed ✅ FIXED
- Missing: pyautogui, pynput, pydantic
- **Solution:** Created `requirements-recorder.txt` with minimal dependencies
- **Status:** ✅ All dependencies now installed

### 2. Python Process Spawn Command Incorrect ✅ FIXED
- **Problem:** Tauri was using `python3 -m __main__` which doesn't work
- **Error:** `ValueError: __main__.__spec__ is None`
- **Solution:** Changed to `python3 __main__.py` (direct file execution)

## Changes Made

### File: `packages/desktop/src-tauri/src/main.rs`

**Before:**
```rust
let mut child = Command::new(python_cmd)
    .arg("-u") // Unbuffered output
    .arg("-m")
    .arg("__main__")
    .current_dir(&python_core_path)
```

**After:**
```rust
let mut child = Command::new(python_cmd)
    .arg("-u") // Unbuffered output
    .arg("__main__.py")
    .current_dir(&python_core_path)
```

### Why This Works

**`python3 -m __main__`** requires:
- Package structure with `__init__.py`
- Proper `__spec__` attribute
- Module import system

**`python3 __main__.py`** simply:
- Runs the file directly
- No module system needed
- Works immediately

## Verification

### Test Python Core Directly

```bash
cd packages/python-core/src
python3 __main__.py <<< '{"command":"check_recordings","params":{}}'
```

Expected output:
```json
{"success": true, "data": {"hasRecordings": false, "count": 0}}
```

✅ **Result:** Works perfectly!

### Test in Tauri App

1. Start app: `pnpm --filter @geniusqa/desktop dev`
2. Navigate to Recorder screen
3. Click "Record" button
4. Python process should start successfully
5. Recording should begin

## Complete Fix Summary

### Step 1: Install Dependencies ✅
```bash
cd packages/python-core
pip3 install -r requirements-recorder.txt
```

### Step 2: Fix Python Spawn Command ✅
Changed Rust code to use `__main__.py` instead of `-m __main__`

### Step 3: Rebuild Tauri ✅
Tauri automatically rebuilds when main.rs changes

## Files Created/Modified

### Created:
1. `requirements-recorder.txt` - Minimal dependencies
2. `install-dependencies.sh` - Auto-install script
3. `DEPENDENCIES.md` - Dependencies documentation
4. `PYTHON_DEPENDENCIES_FIX.md` - Dependencies fix explanation
5. `BROKEN_PIPE_FIX.md` - This file

### Modified:
1. `src-tauri/src/main.rs` - Fixed Python spawn command
2. `src/services/ipcBridgeService.ts` - Better error messages
3. `RECORDER_TROUBLESHOOTING.md` - Updated instructions

## Testing Checklist

- [x] Python dependencies installed
- [x] Python Core runs directly
- [x] Tauri compiles successfully
- [x] App starts without errors
- [ ] Record button works (user to test)
- [ ] Recording captures actions (user to test)
- [ ] Stop button works (user to test)
- [ ] Playback works (user to test)

## Next Steps for User

1. **Start the app:**
   ```bash
   pnpm --filter @geniusqa/desktop dev
   ```

2. **Test recorder:**
   - Click "Record" button
   - Perform some actions (move mouse, click, type)
   - Click "Stop" button
   - Click "Start Playback" to replay

3. **If issues occur:**
   - Check browser console for errors
   - Check terminal for Python errors
   - Refer to `RECORDER_TROUBLESHOOTING.md`

## macOS Accessibility Permissions

If recording doesn't capture actions:

1. Open System Preferences
2. Go to Security & Privacy → Privacy → Accessibility
3. Add Terminal (or Tauri app) to the list
4. Enable the checkbox
5. Restart the app

## Summary

✅ **Dependencies:** Installed (pyautogui, pynput, pydantic, Pillow)
✅ **Python Spawn:** Fixed (use `__main__.py` not `-m __main__`)
✅ **App Compiles:** Successfully
✅ **Ready to Test:** User can now test recording functionality

The "Broken pipe" error should now be resolved! 🎉
