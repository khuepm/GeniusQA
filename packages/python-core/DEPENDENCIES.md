# Python Dependencies

## For Desktop Recorder MVP

The recorder only needs these minimal dependencies:

```bash
pip3 install -r requirements-recorder.txt
```

**Required packages:**
- `pyautogui` - Cross-platform GUI automation
- `pynput` - Mouse and keyboard event listening
- `pydantic` - Data validation
- `Pillow` - Image processing (required by pyautogui)

## For Full Backend (FastAPI)

If you need the full backend with FastAPI:

```bash
pip3 install -r requirements.txt
```

**Note:** The full `requirements.txt` includes many additional packages that are NOT needed for the desktop recorder functionality.

## Installation

### Quick Install (Recommended for Recorder)

```bash
cd packages/python-core
./install-dependencies.sh
```

This script will:
1. Check Python version (requires 3.9+)
2. Install minimal dependencies from `requirements-recorder.txt`
3. Verify installation

### Manual Install

```bash
cd packages/python-core
pip3 install pyautogui pynput pydantic Pillow
```

## Troubleshooting

### Issue: pyobjc installation fails

**Solution:** You don't need pyobjc! The recorder uses the minimal dependencies in `requirements-recorder.txt` which don't include pyobjc.

### Issue: "No module named 'pyautogui'"

**Solution:**
```bash
pip3 install pyautogui
```

### Issue: Permission errors on macOS

**Solution:**
```bash
pip3 install --user pyautogui pynput pydantic Pillow
```

## Platform-Specific Notes

### macOS
- PyAutoGUI and pynput work out of the box
- Requires Accessibility permissions (System Preferences → Security & Privacy)
- Uses pyobjc-core and pyobjc-framework-* (installed automatically with pynput)

### Windows
- May need to install as Administrator
- PyAutoGUI works with native Windows APIs

### Linux
- May need additional system packages:
  ```bash
  sudo apt-get install python3-tk python3-dev
  ```

## Verification

Check if all dependencies are installed:

```bash
python3 -c "import pyautogui; import pynput; import pydantic; print('✅ All dependencies OK')"
```

## Why Two Requirements Files?

- **`requirements-recorder.txt`** - Minimal dependencies for desktop recorder (4 packages)
- **`requirements.txt`** - Full backend dependencies including FastAPI, uvicorn, etc. (11+ packages)

For the desktop app, you only need `requirements-recorder.txt`.
