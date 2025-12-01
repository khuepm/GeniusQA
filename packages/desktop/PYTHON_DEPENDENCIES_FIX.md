# Python Dependencies Fix

## Problem

User encountered error when installing Python dependencies:
```
ERROR: Failed to build 'pyobjc' when getting requirements to build wheel
SyntaxError: invalid syntax
```

## Root Cause

The `requirements.txt` file includes many packages that are NOT needed for the desktop recorder:
- `fastapi` - Backend web framework (not needed)
- `uvicorn` - ASGI server (not needed)
- `aiohttp` - Async HTTP client (not needed)
- `keyboard`, `mouse` - Alternative input libraries (not needed, we use pynput)
- Old `pyobjc` versions that don't work with Python 3.9+

## Solution

Created a minimal requirements file specifically for the recorder:

### File: `requirements-recorder.txt`

```txt
# Minimal dependencies for Desktop Recorder MVP
pyautogui>=0.9.53
pynput>=1.7.6
pydantic>=2.0.0
Pillow>=10.1.0
```

Only 4 packages needed!

### Updated Install Script

`install-dependencies.sh` now uses `requirements-recorder.txt` instead of `requirements.txt`.

## Installation

### Option 1: Use Install Script (Recommended)

```bash
cd packages/python-core
./install-dependencies.sh
```

### Option 2: Manual Install

```bash
cd packages/python-core
pip3 install -r requirements-recorder.txt
```

### Option 3: Direct Install

```bash
pip3 install pyautogui pynput pydantic Pillow
```

## Verification

```bash
python3 -c "import pyautogui; import pynput; import pydantic; print('✅ All dependencies OK')"
```

Expected output:
```
✅ All dependencies OK
```

## What Was Already Installed

The core dependencies were already successfully installed:
- ✅ pyautogui 0.9.54
- ✅ pynput 1.7.6
- ✅ pydantic (already installed)
- ✅ Pillow 11.3.0

The error only occurred when trying to install the full `requirements.txt` which includes unnecessary packages.

## Files Created

1. **`requirements-recorder.txt`** - Minimal dependencies for recorder
2. **`DEPENDENCIES.md`** - Documentation about dependencies
3. **`PYTHON_DEPENDENCIES_FIX.md`** - This file

## Files Updated

1. **`install-dependencies.sh`** - Now uses `requirements-recorder.txt`
2. **`RECORDER_TROUBLESHOOTING.md`** - Updated installation instructions

## Why This Happened

The original `requirements.txt` was designed for a full backend service with FastAPI. The desktop recorder only needs:
- PyAutoGUI for automation
- pynput for event listening
- Pydantic for data validation
- Pillow for image processing

All other packages in `requirements.txt` are unnecessary for the recorder.

## Going Forward

**For Desktop Recorder:**
- Use `requirements-recorder.txt`
- Only 4 packages
- Fast installation
- No compatibility issues

**For Backend Service (if needed later):**
- Use `requirements.txt`
- Includes FastAPI, uvicorn, etc.
- More packages, more potential issues

## Summary

✅ **Problem:** Full requirements.txt has too many dependencies and old pyobjc versions
✅ **Solution:** Created minimal requirements-recorder.txt with only 4 packages
✅ **Result:** All dependencies installed successfully, recorder ready to use

The recorder is now ready to use! 🎉
