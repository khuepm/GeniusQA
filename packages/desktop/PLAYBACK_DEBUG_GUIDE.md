# Playback Debug Guide

## Current Issues

Based on the logs, we see:

1. ✅ **Recording works** - `start_recording` command successful
2. ✅ **Playback starts** - `start_playback` command successful  
3. ❌ **Playback doesn't execute actions** - No visible mouse/keyboard movement
4. ⚠️ **Playback finishes too fast** - "No playback in progress" when trying to stop

## Possible Causes

### 1. macOS Accessibility Permissions Not Granted

**Most likely cause!** On macOS, apps need Accessibility permissions to:
- Control mouse and keyboard (for playback)
- Monitor mouse and keyboard (for recording)

**Solution:**
1. Open System Preferences
2. Go to Security & Privacy → Privacy → Accessibility
3. Click the lock icon to make changes
4. Add Terminal (or the Tauri app) to the list
5. Enable the checkbox
6. **Restart the app completely**

### 2. Recording Captured No Actions

If recording didn't capture any actions, playback will finish instantly.

**Check:**
- Look for `[Recorder]` logs in terminal during recording
- Should see: `[Recorder] Mouse move: (x, y) at 0.50s`
- Should see: `[Recorder] Mouse click: left at (x, y)`

### 3. Python Not Executing Actions

PyAutoGUI might fail silently if permissions are missing.

**Check:**
- Look for `[Player]` logs in terminal during playback
- Should see: `[Player] Starting playback: X actions, speed=1.0x, loops=1`
- Should see: `[Player] Executing action 1/X: mouse_move at (x, y)`

## Debug Steps

### Step 1: Check Recording Logs

Start recording and move mouse, click, type:

**Expected terminal output:**
```
[Recorder] Mouse move: (100, 200) at 0.50s
[Recorder] Mouse click: left at (150, 250)
[Recorder] Mouse move: (200, 300) at 1.00s
```

**If you see these logs:** Recording is working ✅

**If you don't see these logs:** 
- Accessibility permissions not granted ❌
- Python listeners not starting ❌

### Step 2: Check Saved Recording

After stopping recording, check the saved file:

```bash
cat ~/GeniusQA/recordings/script_*.json | jq '.actions | length'
```

**Expected:** Number > 0 (e.g., 10, 50, 100)

**If 0 or file doesn't exist:** Recording didn't capture anything ❌

### Step 3: Check Playback Logs

Start playback:

**Expected terminal output:**
```
[Player] Starting playback: 10 actions, speed=1.0x, loops=1
[Player] Executing action 1/10: mouse_move at (100, 200)
[Player] Executing action 2/10: mouse_click at (150, 250)
...
```

**If you see these logs but no mouse movement:**
- Accessibility permissions not granted for automation ❌
- PyAutoGUI not working ❌

**If you don't see these logs:**
- Playback not starting ❌
- Python process crashed ❌

### Step 4: Test PyAutoGUI Directly

Test if PyAutoGUI can control the mouse:

```bash
cd packages/python-core
python3 -c "import pyautogui; pyautogui.moveTo(500, 500); print('Mouse moved!')"
```

**Expected:** Mouse cursor moves to position (500, 500)

**If mouse doesn't move:**
- Accessibility permissions not granted ❌
- PyAutoGUI not installed correctly ❌

## Logging Added

We've added comprehensive logging to help debug:

### Recording Logs

**File:** `packages/python-core/src/recorder/recorder.py`

```python
# Every 10th mouse move
print(f"[Recorder] Mouse move: ({x}, {y}) at {timestamp:.2f}s", flush=True)

# Every mouse click
print(f"[Recorder] Mouse click: {button.name} at ({x}, {y})", flush=True)
```

### Playback Logs

**File:** `packages/python-core/src/player/player.py`

```python
# At start of playback
print(f"[Player] Starting playback: {len(self.actions)} actions, speed={self.speed}x, loops={self.loop_count}", flush=True)

# For each action
print(f"[Player] Executing action {i+1}/{len(self.actions)}: {action.type} at ({action.x}, {action.y})", flush=True)
```

## How to View Logs

### In Terminal

When running `pnpm --filter @geniusqa/desktop dev`, you'll see:
- Vite logs (frontend)
- Tauri logs (Rust backend)
- Python logs (automation core)

Look for lines starting with `[Recorder]` or `[Player]`.

### In Browser Console

Open DevTools (Right-click → Inspect → Console):
- `[IPC Bridge]` logs show communication between frontend and backend
- `[Recorder]` logs show UI state changes

## Common Error Messages

### "Recording already in progress"

**Cause:** Clicked Record button twice

**Solution:** Click Stop first, then Record again

### "No playback in progress"

**Cause:** Playback already finished when you clicked Stop

**Solution:** This is normal if playback was very short

### "Permission denied"

**Cause:** Accessibility permissions not granted

**Solution:** Follow Step 1 above to grant permissions

## Testing Checklist

- [ ] Python 3.9+ installed: `python3 --version`
- [ ] Dependencies installed: `pip3 list | grep -E "pyautogui|pynput"`
- [ ] Accessibility permissions granted (macOS)
- [ ] App restarted after granting permissions
- [ ] Recording shows `[Recorder]` logs in terminal
- [ ] Saved file has actions: `cat ~/GeniusQA/recordings/script_*.json`
- [ ] Playback shows `[Player]` logs in terminal
- [ ] PyAutoGUI test moves mouse: `python3 -c "import pyautogui; pyautogui.moveTo(500, 500)"`

## Expected Full Flow Logs

### Recording:
```
[IPC Bridge] Invoking start_recording command...
[IPC Bridge] start_recording command successful
[Recorder] Mouse move: (100, 200) at 0.50s
[Recorder] Mouse click: left at (150, 250)
[Recorder] Mouse move: (200, 300) at 1.00s
[IPC Bridge] Invoking stop_recording command...
[IPC Bridge] stop_recording result: {scriptPath: "...", actionCount: 10, ...}
```

### Playback:
```
[IPC Bridge] Invoking start_playback command... {scriptPath: "...", speed: 1, loopCount: 1}
[IPC Bridge] start_playback command successful
[Player] Starting playback: 10 actions, speed=1.0x, loops=1
[Player] Executing action 1/10: mouse_move at (100, 200)
[Player] Executing action 2/10: mouse_click at (150, 250)
...
[IPC Bridge] Received complete event: {}
```

## Next Steps

1. **Grant Accessibility Permissions** (most important!)
2. **Restart the app completely**
3. **Record a new session** and watch terminal for `[Recorder]` logs
4. **Check the saved file** has actions
5. **Play back** and watch terminal for `[Player]` logs
6. **Watch the screen** - mouse should move automatically

If you still don't see mouse movement after granting permissions and restarting, please share:
- Terminal output during recording
- Terminal output during playback
- Content of saved recording file
- macOS version
