# Desktop Recorder MVP - User Guide

## Overview

The Desktop Recorder MVP enables you to record and replay mouse and keyboard interactions on your desktop. This feature allows you to automate repetitive tasks by capturing your actions once and replaying them as needed.

## Features

- **Record**: Capture all mouse movements, clicks, and keyboard inputs
- **Replay**: Automatically execute recorded actions with accurate timing
- **Simple Interface**: Three-button design (Record, Start, Stop) for easy operation
- **Local Storage**: Scripts saved securely on your machine
- **Cross-Platform**: Works on Windows, macOS, and Linux

## Getting Started

### Prerequisites

**Python Requirements:**
- Python 3.9 or higher
- PyAutoGUI library
- pynput library

**Installation:**
```bash
# Install Python dependencies
cd packages/python-core
pip install -r requirements.txt
```

### Platform-Specific Setup

#### macOS

macOS requires special permissions for the recorder to capture and simulate input events.

**Required Permissions:**
1. **Accessibility Permissions** (for both recording and playback)
   - Open System Preferences → Security & Privacy → Privacy
   - Select "Accessibility" from the left sidebar
   - Click the lock icon to make changes
   - Add and enable your application

2. **Input Monitoring** (for recording)
   - Open System Preferences → Security & Privacy → Privacy
   - Select "Input Monitoring" from the left sidebar
   - Add and enable your application

**Note:** You will be prompted to grant these permissions when you first use the recorder.

#### Windows

Windows typically does not require special permissions for PyAutoGUI.

**Optional:**
- Some automation features may require running the application as Administrator
- If you encounter permission errors, try running as Administrator

#### Linux

Linux support depends on your display server.

**X11 (Most Common):**
- PyAutoGUI works out of the box
- May need to install `xdotool`: `sudo apt-get install xdotool`

**Wayland:**
- Limited support; some features may not work
- Consider using X11 compatibility mode

## Using the Recorder

### Recording a Session

1. **Start Recording**
   - Click the "Record" button
   - The status will change to "Recording"
   - Perform the actions you want to automate
   - All mouse movements, clicks, and keyboard inputs are captured

2. **Stop Recording**
   - Click the "Stop" button
   - Your recording is automatically saved with a timestamp
   - The script file is stored in `~/GeniusQA/recordings/`

**Tips:**
- Plan your actions before recording
- Move deliberately to ensure accurate capture
- Avoid unnecessary mouse movements for cleaner scripts

### Playing Back a Recording

1. **Start Playback**
   - Click the "Start" button
   - The most recent recording will play automatically
   - The status will change to "Playing"
   - Actions execute with the same timing as recorded

2. **Stop Playback**
   - Click the "Stop" button at any time to interrupt playback
   - Playback stops immediately

**Important:**
- Do not move your mouse or type during playback
- Ensure the screen layout matches the recording environment
- Close any blocking dialogs or windows before playback

## Script File Format

Recordings are saved as JSON files in `~/GeniusQA/recordings/` with timestamp-based filenames.

### File Structure

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
    },
    {
      "type": "mouse_click",
      "timestamp": 0.5,
      "x": 100,
      "y": 200,
      "button": "left"
    },
    {
      "type": "key_press",
      "timestamp": 1.2,
      "key": "a"
    },
    {
      "type": "key_release",
      "timestamp": 1.3,
      "key": "a"
    }
  ]
}
```

### Field Descriptions

**Metadata:**
- `version`: Script format version (currently "1.0")
- `created_at`: ISO 8601 timestamp of recording
- `duration`: Total recording time in seconds
- `action_count`: Number of actions captured
- `platform`: Operating system (darwin/windows/linux)

**Actions:**
- `type`: Action type (mouse_move, mouse_click, key_press, key_release)
- `timestamp`: Time in seconds since recording start
- `x`, `y`: Screen coordinates (for mouse actions)
- `button`: Mouse button (left/right/middle, for clicks)
- `key`: Key identifier (for keyboard actions)

### File Location

- **Default Directory:** `~/GeniusQA/recordings/`
- **Filename Format:** `script_YYYYMMDD_HHMMSS.json`
- **Example:** `script_20240101_120000.json`

## Troubleshooting

### Recording Issues

**Problem:** "Permission denied" error when starting recording

**Solution (macOS):**
1. Open System Preferences → Security & Privacy → Privacy
2. Enable "Accessibility" and "Input Monitoring" for the app
3. Restart the application
4. Try recording again

**Solution (Windows):**
1. Close the application
2. Right-click the application icon
3. Select "Run as Administrator"
4. Try recording again

---

**Problem:** Recording button is disabled

**Solution:**
- Ensure you're not already recording
- Check that Python Core is running (check console for errors)
- Verify PyAutoGUI and pynput are installed: `pip list | grep -E "pyautogui|pynput"`

---

**Problem:** No actions are captured during recording

**Solution:**
- Verify permissions are granted (see platform-specific setup)
- Check Python Core logs for errors
- Ensure pynput library is properly installed
- Try restarting the application

### Playback Issues

**Problem:** "No recordings found" message

**Solution:**
- Record a session first using the Record button
- Check that `~/GeniusQA/recordings/` directory exists
- Verify script files are present in the directory
- Ensure files have `.json` extension

---

**Problem:** Playback clicks in wrong locations

**Solution:**
- Ensure screen resolution matches recording environment
- Close or move windows that weren't present during recording
- Re-record in the current screen configuration
- Avoid changing display settings between recording and playback

---

**Problem:** Playback is too fast or too slow

**Solution:**
- Timing is preserved from recording; this is expected behavior
- Long delays (>5 seconds) are automatically capped at 5 seconds
- Re-record if timing needs adjustment

---

**Problem:** "Script file corrupted" error

**Solution:**
- The JSON file may be damaged
- Try playing a different recording
- Delete the corrupted file from `~/GeniusQA/recordings/`
- Record a new session

### Python Core Issues

**Problem:** "Python Core unavailable" error

**Solution:**
1. Verify Python 3.9+ is installed: `python --version` or `python3 --version`
2. Install required dependencies:
   ```bash
   cd packages/python-core
   pip install -r requirements.txt
   ```
3. Restart the application

---

**Problem:** "PyAutoGUI not installed" error

**Solution:**
```bash
pip install pyautogui pynput
```

If using a virtual environment, ensure it's activated before installing.

---

**Problem:** Python process crashes during operation

**Solution:**
1. Check Python Core logs in the console
2. Verify all dependencies are installed correctly
3. Try running Python Core manually to see detailed errors:
   ```bash
   cd packages/python-core
   python -m src
   ```
4. Report the error with logs for further assistance

### General Issues

**Problem:** Application freezes during recording or playback

**Solution:**
- Wait a moment; large recordings may take time to process
- If frozen for >30 seconds, restart the application
- Check available disk space (recordings require storage)
- Check system resources (CPU/memory)

---

**Problem:** Keyboard shortcuts don't work during playback

**Solution:**
- This is expected; the system is simulating keyboard input
- Wait for playback to complete or click Stop
- Avoid typing during playback

---

**Problem:** Recording captures sensitive information

**Solution:**
- Script files contain all keystrokes and screen positions
- Store scripts securely; they may contain passwords or sensitive data
- Delete recordings you no longer need
- Never share script files without reviewing their content

## Best Practices

### Recording

1. **Plan Ahead:** Know what actions you want to automate before recording
2. **Clean Environment:** Close unnecessary windows and notifications
3. **Deliberate Actions:** Move mouse smoothly and click precisely
4. **Test First:** Do a quick test run before the actual recording
5. **Short Sessions:** Keep recordings under 5 minutes for reliability

### Playback

1. **Match Environment:** Ensure screen layout matches recording
2. **Don't Interfere:** Keep hands off mouse and keyboard during playback
3. **Monitor First Run:** Watch the first playback to verify correctness
4. **Safe Testing:** Test on non-critical data first
5. **Have Backups:** Back up important data before automation

### Security

1. **Local Only:** Scripts are stored locally; never auto-upload
2. **Review Scripts:** Check script files before sharing
3. **Secure Storage:** Protect the recordings directory
4. **Delete Old Scripts:** Remove recordings you no longer need
5. **Sensitive Data:** Avoid recording passwords or sensitive information

## Limitations (MVP)

- No script editing interface (edit JSON manually if needed)
- Plays most recent recording only (no script selection UI)
- No conditional logic or variables
- No screenshot capture during recording
- No playback speed control
- Mouse move events may be sampled (not every pixel)
- Very long delays (>5 seconds) are capped at 5 seconds

## Support

For issues not covered in this guide:

1. Check the console logs for detailed error messages
2. Verify all prerequisites are met
3. Try the troubleshooting steps above
4. Review the script file format for corruption
5. Contact support with error logs and system information

## Technical Details

**Architecture:**
- React Native Desktop UI (TypeScript)
- Python Core automation backend (Python 3.9+)
- IPC communication via stdin/stdout
- JSON-based script format

**Dependencies:**
- PyAutoGUI: Cross-platform GUI automation
- pynput: Event listening and capture
- Pydantic: Data validation

**Storage:**
- Location: `~/GeniusQA/recordings/`
- Format: JSON with schema validation
- Naming: Timestamp-based for uniqueness
